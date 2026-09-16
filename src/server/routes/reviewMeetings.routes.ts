import { Router } from 'express';
import { User, UserRole, ReviewMeeting, ReviewMeetingStatus } from '../../serverTypes';
import { state } from '../state';
import { getUser } from '../middleware/auth';
import { getActiveDelegation } from '../services/delegations';
import { sendEmail } from '../services/notifications';
import { persistReviewMeeting } from '../../db/workflowExtrasRepo';

export const reviewMeetingsRouter = Router();

reviewMeetingsRouter.get('/review-meetings', (req, res) => {
  const user = getUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  let relevant: ReviewMeeting[] = [];
  if (user.role === UserRole.REQUESTOR) {
    relevant = state.reviewMeetings.filter(rm => rm.requestor_id === user.id);
  } else if (user.role === UserRole.APPROVER) {
    const reporteeIds = state.users.filter(u => u.reports_to === user.id).map(u => u.id);
    relevant = state.reviewMeetings.filter(rm => rm.requestor_id === user.id || reporteeIds.includes(rm.requestor_id));
  } else if (user.role === UserRole.ADMIN) {
    relevant = state.reviewMeetings;
  }

  const enriched = relevant.map(rm => {
    const requestor = state.users.find(u => u.id === rm.requestor_id);
    const approver = state.users.find(u => u.id === rm.approver_id);
    const claim = state.claims.find(c => c.id === rm.claim_id);
    return {
      ...rm,
      requestor_name: requestor?.name || 'Unknown',
      approver_name: approver?.name || 'Unknown',
      claim_number: claim?.claim_number,
      total_amount: claim?.total_amount
    };
  });

  res.json(enriched);
});

const isAuthorizedForReviewMeeting = (rm: ReviewMeeting, user: User): boolean => {
  if (rm.approver_id === user.id) return true;
  return getActiveDelegation(rm.approver_id)?.delegate_id === user.id;
};

reviewMeetingsRouter.post('/review-meetings/:id/confirm', async (req, res) => {
  const user = getUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const rm = state.reviewMeetings.find(r => r.id === req.params.id);
  if (!rm) return res.status(404).json({ error: 'Review Meeting not found' });
  if (!isAuthorizedForReviewMeeting(rm, user)) {
    return res.status(403).json({ error: 'Forbidden: not your assigned Review Meeting' });
  }
  if (rm.status !== ReviewMeetingStatus.PENDING_CONFIRMATION) {
    return res.status(400).json({ error: 'Only a meeting pending confirmation can be confirmed.' });
  }

  rm.status = ReviewMeetingStatus.CONFIRMED;
  rm.decline_reason = undefined;

  const claim = state.claims.find(c => c.id === rm.claim_id);
  const claimNumber = claim?.claim_number || `REIM-${rm.claim_id.substring(0, 6)}`;

  sendEmail(
    rm.requestor_id,
    `Review Meeting Confirmed - ${claimNumber}`,
    `${user.name} has confirmed your proposed Review Meeting for claim ${claimNumber} on ${rm.meeting_date} at ${rm.meeting_time}.

Reference:
${claimNumber}`
  );

  try {
    await persistReviewMeeting(rm);
  } catch (err) {
    console.error('[db] Could not persist review meeting confirmation to Postgres:', err);
  }
  res.json(rm);
});

reviewMeetingsRouter.post('/review-meetings/:id/decline', async (req, res) => {
  const user = getUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const rm = state.reviewMeetings.find(r => r.id === req.params.id);
  if (!rm) return res.status(404).json({ error: 'Review Meeting not found' });
  if (!isAuthorizedForReviewMeeting(rm, user)) {
    return res.status(403).json({ error: 'Forbidden: not your assigned Review Meeting' });
  }
  if (rm.status !== ReviewMeetingStatus.PENDING_CONFIRMATION) {
    return res.status(400).json({ error: 'Only a meeting pending confirmation can be declined.' });
  }

  const { reason } = req.body;
  rm.status = ReviewMeetingStatus.DECLINE_REQUESTED;
  rm.decline_reason = reason || undefined;

  const claim = state.claims.find(c => c.id === rm.claim_id);
  const claimNumber = claim?.claim_number || `REIM-${rm.claim_id.substring(0, 6)}`;

  sendEmail(
    rm.requestor_id,
    `Review Meeting Declined - ${claimNumber}`,
    `${user.name} can't make the proposed Review Meeting for claim ${claimNumber} on ${rm.meeting_date} at ${rm.meeting_time}.
${reason ? `\nReason:\n${reason}\n` : ''}
Required Action:
Please log in to the system and propose a new date/time for this Review Meeting.`
  );

  try {
    await persistReviewMeeting(rm);
  } catch (err) {
    console.error('[db] Could not persist review meeting decline to Postgres:', err);
  }
  res.json(rm);
});

reviewMeetingsRouter.put('/review-meetings/:id/reschedule', async (req, res) => {
  const user = getUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const rm = state.reviewMeetings.find(r => r.id === req.params.id && r.requestor_id === user.id);
  if (!rm) return res.status(404).json({ error: 'Review Meeting not found' });
  if (rm.status === ReviewMeetingStatus.COMPLETED) {
    return res.status(400).json({ error: 'This Review Meeting has already been completed.' });
  }

  const { meeting_date, meeting_time } = req.body;
  if (!meeting_date || !meeting_time) {
    return res.status(400).json({ error: 'A new meeting date and time are required.' });
  }

  const hasConflict = state.reviewMeetings.some(other =>
    other.id !== rm.id &&
    other.approver_id === rm.approver_id &&
    [ReviewMeetingStatus.PENDING_CONFIRMATION, ReviewMeetingStatus.CONFIRMED].includes(other.status) &&
    other.meeting_date === meeting_date &&
    other.meeting_time === meeting_time
  );
  if (hasConflict) {
    return res.status(409).json({ error: 'Your Approver already has a Review Meeting scheduled at that date and time. Please choose another slot.' });
  }

  rm.meeting_date = meeting_date;
  rm.meeting_time = meeting_time;
  rm.status = ReviewMeetingStatus.PENDING_CONFIRMATION;
  rm.decline_reason = undefined;

  const claim = state.claims.find(c => c.id === rm.claim_id);
  const claimNumber = claim?.claim_number || (rm.claim_id ? `REIM-${rm.claim_id.substring(0, 6)}` : 'Unknown');

  sendEmail(
    rm.approver_id,
    `Review Meeting Rescheduled - ${claimNumber}`,
    `${user.name} has proposed a new time for the Review Meeting on claim ${claimNumber}: ${meeting_date} at ${meeting_time}.

Required Action:
Please log in to the system and confirm or decline this new time.`
  );

  try {
    await persistReviewMeeting(rm);
  } catch (err) {
    console.error('[db] Could not persist review meeting reschedule to Postgres:', err);
  }
  res.json(rm);
});

reviewMeetingsRouter.get('/approver/schedule', (req, res) => {
  const user = getUser(req);
  if (!user || !user.reports_to) return res.json([]);

  let currentApproverId = user.reports_to;
  const activeDelegation = getActiveDelegation(user.reports_to);
  if (activeDelegation) {
    currentApproverId = activeDelegation.delegate_id;
  }

  const relevantClaims = state.claims.filter(c => c.current_approver_id === currentApproverId);
  const relevantClaimIds = relevantClaims.map(c => c.id);
  const relevantMoms = state.moms.filter(m => m.claim_id && relevantClaimIds.includes(m.claim_id));

  res.json(relevantMoms);
});

reviewMeetingsRouter.get('/approver/review-meetings', (req, res) => {
  const user = getUser(req);
  if (!user || !user.reports_to) return res.json([]);

  let currentApproverId = user.reports_to;
  const activeDelegation = getActiveDelegation(user.reports_to);
  if (activeDelegation) {
    currentApproverId = activeDelegation.delegate_id;
  }

  const relevant = state.reviewMeetings.filter(rm => rm.approver_id === currentApproverId && [ReviewMeetingStatus.PENDING_CONFIRMATION, ReviewMeetingStatus.CONFIRMED].includes(rm.status));
  res.json(relevant.map(rm => ({ meeting_date: rm.meeting_date, meeting_time: rm.meeting_time })));
});
