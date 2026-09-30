'use server';

import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../../lib/db';
import { Claim, ClaimStatus, Approval, ReviewMeeting, ReviewMeetingStatus, UserRole } from '../../lib/db/serverTypes';
import { persistClaim, insertApproval, persistStatusHistoryFireAndForget } from '../../lib/db/coreLoopRepo';
import { persistReviewMeeting } from '../../lib/db/workflowExtrasRepo';
import { sendEmail, notifyClientCcSent } from '../../server/services/notifications';
import { formatPHP, REIMBURSEMENT_CAP } from '../../server/constants';
import { headers } from 'next/headers';

export async function approveClaimAction(id: string, body: any) {
  const userId = (await headers()).get('x-user-id');
  if (!userId) return { status: 401, body: { error: 'Unauthorized' } };

  const db = getDb();

  // 1. Fetch User directly
  const userRow = await db.users.findUnique({ where: { id: userId } });
  if (!userRow) return { status: 401, body: { error: 'Unauthorized' } };
  const user = { ...userRow, role: userRow.role as UserRole };

  // 2. Fetch Claim directly
  const claimRow = await db.claims.findUnique({ where: { id } });
  if (!claimRow) return { status: 404, body: { error: 'Not found' } };
  const claim = claimRow as unknown as Claim;

  if (claim.requestor_id === user.id) {
    return { status: 403, body: { error: 'Segregation of Duties: You cannot approve your own reimbursement claim.' } };
  }

  // Fetch requestor
  const requestorRow = await db.users.findUnique({ where: { id: claim.requestor_id } });
  const requestor = requestorRow ? { ...requestorRow, role: requestorRow.role as UserRole } : null;

  // Check delegation
  let isDelegate = false;
  if (claim.current_approver_id !== user.id && claim.original_approver_id !== user.id) {
    const delegation = await db.approver_delegations.findFirst({
      where: {
        approver_id: claim.current_approver_id,
        delegate_id: user.id,
        status: 'Active'
      }
    });
    isDelegate = !!delegation;
  }

  if (
    claim.current_approver_id !== user.id &&
    claim.original_approver_id !== user.id &&
    !isDelegate
  ) {
    return { status: 403, body: { error: 'Not your direct report' } };
  }

  if (claim.status !== ClaimStatus.PENDING_APPROVAL) {
    return { status: 409, body: { error: `This claim is "${claim.status}" and is no longer awaiting an approval decision.` } };
  }

  const { decision, comment, review_meeting_date, review_meeting_time } = body || {};
  if (!['Approved', 'Rejected', 'Returned'].includes(decision)) return { status: 400, body: { error: 'Invalid decision' } };
  if ((decision === 'Rejected' || decision === 'Returned') && !comment) {
    return { status: 400, body: { error: 'Comment required' } };
  }
  if (Boolean(review_meeting_date) !== Boolean(review_meeting_time)) {
    return { status: 400, body: { error: 'Provide both a review meeting date and time, or leave both blank.' } };
  }
  if (review_meeting_date && decision === 'Approved') {
    return { status: 400, body: { error: 'A review meeting can only be scheduled when returning or rejecting a claim.' } };
  }

  if (review_meeting_date) {
    const hasConflict = await db.review_meetings.findFirst({
      where: {
        approver_id: user.id,
        status: { in: ['PendingConfirmation', 'Confirmed'] },
        meeting_date: review_meeting_date,
        meeting_time: review_meeting_time
      }
    });
    if (hasConflict) {
      return { status: 409, body: { error: 'You already have a review meeting scheduled at that date and time.' } };
    }
  }

  const oldStatus = claim.status;
  let newStatus: ClaimStatus = claim.status;

  if (decision === 'Approved') newStatus = ClaimStatus.PROCESSING;
  else if (decision === 'Rejected') newStatus = ClaimStatus.REJECTED;
  else if (decision === 'Returned') newStatus = ClaimStatus.RETURNED;

  claim.status = newStatus;
  claim.updated_at = new Date().toISOString();

  const newApproval: Approval = {
    id: uuidv4(),
    claim_id: claim.id,
    approver_id: user.id,
    decision,
    comment: comment || '',
    timestamp: new Date().toISOString()
  };

  persistStatusHistoryFireAndForget({
    id: uuidv4(),
    claim_id: claim.id,
    old_status: oldStatus,
    new_status: newStatus,
    changed_by: user.id,
    reason: comment || decision,
    timestamp: new Date().toISOString()
  });

  let newReviewMeeting: ReviewMeeting | undefined;
  if (review_meeting_date && review_meeting_time) {
    newReviewMeeting = {
      id: uuidv4(),
      claim_id: claim.id,
      requestor_id: claim.requestor_id,
      approver_id: user.id,
      meeting_date: review_meeting_date,
      meeting_time: review_meeting_time,
      status: ReviewMeetingStatus.CONFIRMED,
      created_at: new Date().toISOString()
    };
    persistStatusHistoryFireAndForget({
      id: uuidv4(),
      claim_id: claim.id,
      old_status: newStatus,
      new_status: newStatus,
      changed_by: user.id,
      reason: `Review meeting scheduled for ${review_meeting_date} at ${review_meeting_time}`,
      timestamp: new Date().toISOString()
    });
  }

  const claimNumber = claim.claim_number || `REIM-${claim.id.substring(0,6)}`;
  const claimType = claim.claim_type || 'Reimbursement';

  if (decision === 'Approved') {
    claim.approved_at = new Date().toISOString();
    claim.approved_amount = Math.min(claim.total_amount, REIMBURSEMENT_CAP);

    const approvedSubject = `Approved - ${claimNumber}`;
    const approvedBody = `Your reimbursement request ${claimNumber} has been approved by ${user.name}. It has been forwarded to the Custodian for processing and payment release.

Claimed amount: ${formatPHP(claim.total_amount)}
Approved reimbursement: ${formatPHP(claim.approved_amount)}${claim.total_amount > REIMBURSEMENT_CAP ? ` (capped at ${formatPHP(REIMBURSEMENT_CAP)})` : ''}

Reference:
${claimNumber}`;
    sendEmail(claim.requestor_id, approvedSubject, approvedBody, undefined, { eventKey: 'approved' });

    const custodians = await db.users.findMany({ where: { role: 'Custodian' } });
    custodians.forEach(c => {
      const custodianSubject = `Reimbursement Processing Required - ${claimNumber}`;
      const custodianBody = `Reimbursement request ${claimNumber} submitted by ${requestor?.name || 'Requestor'} and approved by ${user.name} is now in your processing queue.

Reference:
${claimNumber}

Required Action:
Please generate the Claim Code, release the payment, and mark it as Ready for Claim.`;
      sendEmail(c.id, custodianSubject, custodianBody);
    });
  } else {
    claim.approved_at = undefined;
    claim.approved_amount = undefined;
    claim.paid_at = undefined;
    claim.paid_amount = undefined;
    const actionText = decision === 'Returned' ? 'Please revise and resubmit your claim.' : 'No action required.';
    const meetingText = review_meeting_date && review_meeting_time
      ? `\n\nReview Meeting:\n${review_meeting_date} at ${review_meeting_time}`
      : '';
    const emailSubject = `Reimbursement ${decision} - ${claimNumber}`;
    const emailBody = `Your reimbursement request ${claimNumber} has been ${decision.toLowerCase()} by ${user.name}.

Reason:
${comment}${meetingText}

Reference:
${claimNumber}

Required Action:
${actionText}`;
    sendEmail(claim.requestor_id, emailSubject, emailBody, undefined,
      decision === 'Returned' ? { eventKey: 'returned' } : undefined);
  }

  if (claim.mom_id) {
    const momRow = await db.moms.findUnique({ where: { id: claim.mom_id } });
    if (momRow && momRow.cc_client && momRow.contact_person_email) {
      sendEmail(
        momRow.contact_person_email,
        `Copy: Reimbursement ${decision} - ${claimNumber}`,
        `${claimNumber}, filed by ${requestor?.name || 'the requestor'}, was ${decision.toLowerCase()}.${comment ? `\n\nComment: ${comment}` : ''}`,
        undefined,
        { plain: true, recipientName: momRow.contact_person ?? undefined, fromLabel: `${user.name} via Sales Reimbursement System` }
      );
      notifyClientCcSent({
        recipientIds: [claim.requestor_id, user.id],
        claimNumber,
        clientName: momRow.contact_person,
        clientEmail: momRow.contact_person_email,
        eventLabel: decision,
      });
    }
  }

  try {
    await persistClaim(claim);
    await insertApproval(newApproval);
    if (newReviewMeeting) await persistReviewMeeting(newReviewMeeting);
  } catch (err) {
    console.error('[db] Could not persist approval decision to Postgres:', err);
    return { status: 500, body: { error: 'Database error' } };
  }

  return { status: 200, body: claim };
}
