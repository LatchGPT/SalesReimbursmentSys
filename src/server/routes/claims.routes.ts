import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import {
  Claim, ClaimStatus, Approval, Mom, MomStatus, UserRole,
  CashAdvanceStatus, LiquidationStatus, ReviewMeeting, ReviewMeetingStatus
} from '../../lib/db/serverTypes';
import { state, checkCategoryLimits } from '../state';
import { getUser } from '../middleware/auth';
import { canAccessClaim } from '../services/authorization';
import { isActiveDelegateFor, getActiveDelegation } from '../services/delegations';
import { generateClaimNumber } from '../services/claimNumber';
import { generateReleaseCode, resetReleaseCodeSecurity, timingSafeCodeEquals } from '../services/releaseCode';
import { addHistory, addCaHistory, addLiqHistory } from '../services/history';
import { sendEmail, notifyClientCcSent } from '../services/notifications';
import {
  formatPHP, REIMBURSEMENT_CAP, RELEASE_CODE_MAX_ATTEMPTS,
  RELEASE_CODE_LOCKOUT_MINUTES, isFinanceVisibleFinancialRecord
} from '../constants';
import { normalizeExpenseCategory } from '../../lib/expenseCategories';
import { getReimbursementDateError, getTodayIsoDate } from '../../features/claims/domain/reimbursementPolicy';
import { persistClaim, persistClaimWithLineItems, insertApproval } from '../../lib/db/coreLoopRepo';
import { persistCashAdvance, persistLiquidation } from '../../lib/db/cashAdvanceRepo';
import { persistReviewMeeting } from '../../lib/db/workflowExtrasRepo';

export const claimsRouter = Router();

claimsRouter.get('/claims', (req, res) => {
  const user = getUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  let filtered: Claim[] = [];
  if (user.role === UserRole.REQUESTOR) {
    filtered = state.claims.filter(c => c.requestor_id === user.id);
  } else if (user.role === UserRole.APPROVER) {
    filtered = state.claims.filter(c => c.current_approver_id === user.id || c.original_approver_id === user.id || c.requestor_id === user.id || isActiveDelegateFor(user.id, c.current_approver_id));
  } else if (user.role === UserRole.CUSTODIAN) {
    filtered = state.claims.filter(c => [ClaimStatus.APPROVED, ClaimStatus.PROCESSING, ClaimStatus.READY_FOR_CLAIM, ClaimStatus.COMPLETED].includes(c.status) || c.requestor_id === user.id);
  } else if (user.role === UserRole.FINANCE) {
    filtered = state.claims.filter(c => isFinanceVisibleFinancialRecord(c.claim_type || 'Reimbursement', c.status));
  } else if (user.role === UserRole.ADMIN) {
    filtered = state.claims; // Admin sees all
  }

  const enriched = filtered.map(c => {
    const mom = state.moms.find(m => m.id === c.mom_id);
    const reqUser = state.users.find(u => u.id === c.requestor_id);
    const claimExpenses = state.expenses.filter(e => e.claim_id === c.id);
    const claimApprovals = state.approvals.filter(a => a.claim_id === c.id);
    const claimHistory = state.statusHistories.filter(h => h.claim_id === c.id).map(h => ({
      ...h,
      changedBy: state.users.find(u => u.id === h.changed_by)
    })).sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    const reviewMeeting = state.reviewMeetings.find(rm => rm.claim_id === c.id);
    return { ...c, mom, requestor: reqUser, expenses: claimExpenses, approvals: claimApprovals, history: claimHistory, reviewMeeting };
  });

  const { page, pageSize, search, status } = req.query;

  let scoped = enriched;
  if (typeof status === 'string' && status.trim()) {
    scoped = scoped.filter(c => c.status === status);
  }
  if (typeof search === 'string' && search.trim()) {
    const q = search.trim().toLowerCase();
    scoped = scoped.filter((c: any) =>
      [c.claim_number, c.mom?.purpose].some(v => (v || '').toString().toLowerCase().includes(q))
    );
  }

  if (page && pageSize) {
    const p = Math.max(1, parseInt(page as string, 10) || 1);
    const ps = Math.max(1, parseInt(pageSize as string, 10) || 25);
    const total = scoped.length;
    const items = scoped
      .slice()
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice((p - 1) * ps, p * ps);
    return res.json({ items, total, page: p, pageSize: ps });
  }

  res.json(enriched);
});

claimsRouter.get('/claims/:id', (req, res) => {
  const user = getUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const claim = state.claims.find(c => c.id === req.params.id);
  if (!claim) return res.status(404).json({ error: 'Not found' });

  if (!canAccessClaim(user, claim)) return res.status(403).json({ error: 'Forbidden' });

  const claimExpenses = state.expenses.filter(e => e.claim_id === claim.id);
  const claimApprovals = state.approvals.filter(a => a.claim_id === claim.id);
  const claimHistory = state.statusHistories.filter(h => h.claim_id === claim.id).map(h => ({
    ...h,
    changedBy: state.users.find(u => u.id === h.changed_by)
  })).sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  const mom = state.moms.find(m => m.id === claim.mom_id);
  const requestor = state.users.find(u => u.id === claim.requestor_id);
  const reviewMeeting = state.reviewMeetings.find(rm => rm.claim_id === claim.id);

  res.json({
    ...claim,
    expenses: claimExpenses,
    approvals: claimApprovals,
    history: claimHistory,
    mom,
    requestor,
    reviewMeeting
  });
});

claimsRouter.post('/claims', async (req, res) => {
  const user = getUser(req);
  if (!user || !user.reports_to) return res.status(403).json({ error: 'Forbidden: You must have a designated manager (reports_to) to submit.' });

  const { claim_type, mom_id, expense_category, total_amount, receipt_url, or_number, expense_date, remarks, supporting_documents, line_items, is_draft } = req.body;
  const claimType = claim_type === 'Transport Reimbursement' ? 'Transport Reimbursement' : 'Reimbursement';
  const isTransportReimbursement = claimType === 'Transport Reimbursement';

  if (!isTransportReimbursement && !mom_id) {
    return res.status(400).json({ error: 'Minutes of Meeting (MOM) is required.' });
  }
  const mom = mom_id ? state.moms.find(m => m.id === mom_id) : undefined;
  if (mom_id && !mom) return res.status(400).json({ error: 'Minutes of Meeting (MOM) not found.' });

  if (!is_draft && mom && mom.status !== MomStatus.COMPLETED) {
    return res.status(400).json({ error: 'Cannot attach an incomplete or draft Minutes of Meeting.' });
  }
  if (mom?.claim_id) {
    return res.status(400).json({ error: 'This Minutes of Meeting is already linked to another claim and cannot be reused.' });
  }

  let itemsToCreate: any[] = [];
  let claimTotal = 0;
  let mainCategory = normalizeExpenseCategory(expense_category || 'Multiple Categories');
  let mainReceipt = receipt_url || '';

  if (line_items && Array.isArray(line_items) && line_items.length > 0) {
    for (const [index, item] of line_items.entries()) {
      if (!is_draft && !item.category) return res.status(400).json({ error: 'Each expense must have a category.' });
      const numericAmount = Number(item.amount);
      if (isNaN(numericAmount) || numericAmount <= 0) return res.status(400).json({ error: 'Each expense amount must be a valid number greater than zero.' });
      if (!item.receipt_url) return res.status(400).json({ error: 'Each expense must have a receipt.' });
      if (!is_draft) {
        const dateError = getReimbursementDateError(item.expense_date, getTodayIsoDate());
        if (dateError) return res.status(400).json({ error: `Expense row ${index + 1}: ${dateError}` });
      }

      itemsToCreate.push({
        category: normalizeExpenseCategory(item.category),
        amount: numericAmount,
        receipt_url: item.receipt_url,
        or_number: item.or_number,
        vendor: item.vendor,
        expense_date: item.expense_date,
        payment_method: item.payment_method,
        business_purpose: item.business_purpose || remarks ||
          (isTransportReimbursement ? 'Business transport reimbursement' : `Sales reimbursement for meeting with ${mom?.client || 'client'}`)
      });
      claimTotal += numericAmount;
    }
    mainCategory = itemsToCreate.length === 1 ? itemsToCreate[0].category : 'Multiple Categories';
    mainReceipt = itemsToCreate[0].receipt_url;
  } else {
    if (!is_draft) {
      const dateError = getReimbursementDateError(expense_date, getTodayIsoDate());
      if (dateError) return res.status(400).json({ error: dateError });
    }
    if (!expense_category) return res.status(400).json({ error: 'Expense Category is required.' });
    if (total_amount === undefined || total_amount === null || total_amount === '') {
      return res.status(400).json({ error: 'Expense amount is required.' });
    }
    const numericAmount = Number(total_amount);
    if (isNaN(numericAmount)) {
      return res.status(400).json({ error: 'Expense amount must be a valid number.' });
    }
    if (numericAmount <= 0) {
      return res.status(400).json({ error: 'Expense amount must be greater than zero.' });
    }
    if (!receipt_url) return res.status(400).json({ error: 'Receipt image or PDF is required.' });

    itemsToCreate.push({
      category: normalizeExpenseCategory(expense_category),
      amount: numericAmount,
      receipt_url: receipt_url,
      or_number: or_number,
      expense_date,
      business_purpose: remarks ||
        (isTransportReimbursement ? 'Business transport reimbursement' : `Sales reimbursement for meeting with ${mom?.client || 'client'}`)
    });
    claimTotal = numericAmount;
    mainCategory = normalizeExpenseCategory(expense_category);
    mainReceipt = receipt_url;
  }

  if (!is_draft) {
    const policyError = checkCategoryLimits(itemsToCreate);
    if (policyError) return res.status(400).json({ error: policyError });
  }

  const claimId = uuidv4();
  const claimNumber = await generateClaimNumber();

  for (const item of itemsToCreate) {
    state.expenses.push({
      id: uuidv4(),
      claim_id: claimId,
      expense_date: item.expense_date || mom?.meeting_date || new Date().toISOString().split('T')[0],
      vendor: item.vendor || mom?.client || (isTransportReimbursement ? 'Transport Provider' : 'Client Meeting'),
      category: item.category,
      amount: item.amount,
      payment_method: item.payment_method || 'Cash',
      business_purpose: item.business_purpose,
      receipt_url: item.receipt_url,
      or_number: item.or_number
    });
  }

  let originalApproverId: string | undefined = undefined;
  let currentApproverId = user.reports_to || '';

  if (user.reports_to) {
    const activeDelegation = getActiveDelegation(user.reports_to);
    if (activeDelegation) {
      originalApproverId = user.reports_to;
      currentApproverId = activeDelegation.delegate_id;
    }
  }

  const claim: Claim = {
    id: claimId,
    claim_number: claimNumber,
    requestor_id: user.id,
    current_approver_id: currentApproverId,
    original_approver_id: originalApproverId,
    mom_id: mom_id || undefined,
    claim_type: claimType,
    status: is_draft ? ClaimStatus.DRAFT : ClaimStatus.PENDING_APPROVAL,
    total_amount: claimTotal,
    expense_category: mainCategory,
    receipt_url: mainReceipt,
    remarks,
    supporting_documents,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    flagged_high_value: itemsToCreate.some(item => item.amount > state.systemSettings.highValueThreshold)
  };

  state.claims.push(claim);
  if (mom) mom.claim_id = claimId;

  try {
    await persistClaimWithLineItems(claim, state.expenses.filter(e => e.claim_id === claim.id), mom ? [mom] : []);
  } catch (err) {
    console.error('[db] Could not persist new claim to Postgres:', err);
  }

  addHistory(
    claim.id,
    ClaimStatus.DRAFT,
    claim.status,
    user.id,
    is_draft ? 'Draft saved by requestor' : `${claimType} filed and received by the system`
  );

  if (!is_draft && originalApproverId && currentApproverId !== originalApproverId) {
    const origName = state.users.find(u => u.id === originalApproverId)?.name || originalApproverId;
    const delegateName = state.users.find(u => u.id === currentApproverId)?.name || currentApproverId;

    state.statusHistories.push({
      id: uuidv4(),
      claim_id: claim.id,
      old_status: ClaimStatus.DRAFT,
      new_status: ClaimStatus.PENDING_APPROVAL,
      changed_by: user.id,
      reason: `Auto-routed to delegate ${delegateName} (on behalf of ${origName})`,
      timestamp: new Date().toISOString()
    });
  }

  if (!is_draft && currentApproverId) {
    const approver = state.users.find(u => u.id === currentApproverId);
    const approverName = approver ? approver.name : 'Approver';

    const emailSubject = `${claimType} Submitted - ${claimNumber}`;
    const emailBody = `A new ${claimType.toLowerCase()} request ${claimNumber} by ${user.name} has been submitted and is awaiting your review and approval.

Reference:
${claimNumber}

Required Action:
Please log in to the system and navigate to the Approval Queue to approve or reject this claim.`;

    sendEmail(currentApproverId, emailSubject, emailBody, undefined, { eventKey: 'submitted' });

    sendEmail(
      user.id,
      `${claimType} Submitted - ${claimNumber}`,
      `Your ${claimType.toLowerCase()} request ${claimNumber} for PHP ${claimTotal} has been successfully submitted and routed to ${approverName} for review.

Reference:
${claimNumber}

You'll receive another email as soon as ${approverName} makes a decision.`,
      undefined,
      { eventKey: 'submitted' }
    );

    if (mom?.cc_client && mom.contact_person_email) {
      sendEmail(
        mom.contact_person_email,
        `Copy: ${claimType} Submitted - ${claimNumber}`,
        `${user.name} submitted ${claimNumber}, which references the meeting with ${mom.client || 'your organization'}. This is a courtesy copy requested by the filer.`,
        undefined,
        { plain: true, recipientName: mom.contact_person || undefined, fromLabel: `${user.name} via Sales Reimbursement System` }
      );
      notifyClientCcSent({
        recipientIds: [user.id, currentApproverId],
        claimNumber,
        clientName: mom.contact_person,
        clientEmail: mom.contact_person_email,
        eventLabel: 'Submission',
      });
    }
  }

  res.json(claim);
});

claimsRouter.put('/claims/:id/resubmit', async (req, res) => {
  const user = getUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const claim = state.claims.find(c => c.id === req.params.id && c.requestor_id === user.id);
  if (!claim) return res.status(404).json({ error: 'Claim not found' });
  if (claim.status !== ClaimStatus.RETURNED) {
    return res.status(400).json({ error: 'Only a claim that has been Returned can be revised and resubmitted.' });
  }

  const { mom_id, claim_type, expense_category, total_amount, receipt_url, or_number, expense_date, remarks, supporting_documents, line_items } = req.body;
  const claimType = claim_type === 'Transport Reimbursement' || claim.claim_type === 'Transport Reimbursement'
    ? 'Transport Reimbursement'
    : 'Reimbursement';
  const isTransportReimbursement = claimType === 'Transport Reimbursement';

  if (!isTransportReimbursement && !mom_id) return res.status(400).json({ error: 'Minutes of Meeting (MOM) is required.' });
  const mom = mom_id ? state.moms.find(m => m.id === mom_id) : undefined;
  if (mom_id && !mom) return res.status(400).json({ error: 'Minutes of Meeting (MOM) not found.' });
  if (mom && mom.status !== MomStatus.COMPLETED) {
    return res.status(400).json({ error: 'Cannot attach an incomplete or draft Minutes of Meeting.' });
  }
  if (mom?.claim_id && mom.claim_id !== claim.id) {
    const linkedClaim = state.claims.find(c => c.id === mom.claim_id);
    const linkedNumber = linkedClaim?.claim_number || (mom.claim_id ? `REIM-${mom.claim_id.substring(0, 6)}` : 'another claim');
    return res.status(400).json({ error: `This MOM is already linked to claim ${linkedNumber}.` });
  }

  let itemsToCreate: any[] = [];
  let claimTotal = 0;
  let mainCategory = normalizeExpenseCategory(expense_category || 'Multiple Categories');
  let mainReceipt = receipt_url || '';

  if (line_items && Array.isArray(line_items) && line_items.length > 0) {
    for (const [index, item] of line_items.entries()) {
      if (!item.category) return res.status(400).json({ error: 'Each expense must have a category.' });
      const numericAmount = Number(item.amount);
      if (isNaN(numericAmount) || numericAmount <= 0) return res.status(400).json({ error: 'Each expense amount must be a valid number greater than zero.' });
      if (!item.receipt_url) return res.status(400).json({ error: 'Each expense must have a receipt.' });
      const dateError = getReimbursementDateError(item.expense_date, getTodayIsoDate());
      if (dateError) return res.status(400).json({ error: `Expense row ${index + 1}: ${dateError}` });

      itemsToCreate.push({
        category: normalizeExpenseCategory(item.category),
        amount: numericAmount,
        receipt_url: item.receipt_url,
        or_number: item.or_number,
        vendor: item.vendor,
        expense_date: item.expense_date,
        payment_method: item.payment_method,
        business_purpose: item.business_purpose || remarks ||
          (isTransportReimbursement ? 'Business transport reimbursement' : `Sales reimbursement for meeting with ${mom?.client || 'client'}`)
      });
      claimTotal += numericAmount;
    }
    mainCategory = itemsToCreate.length === 1 ? itemsToCreate[0].category : 'Multiple Categories';
    mainReceipt = itemsToCreate[0].receipt_url;
  } else {
    const dateError = getReimbursementDateError(expense_date, getTodayIsoDate());
    if (dateError) return res.status(400).json({ error: dateError });
    if (!expense_category) return res.status(400).json({ error: 'Expense Category is required.' });
    if (total_amount === undefined || total_amount === null || total_amount === '') {
      return res.status(400).json({ error: 'Expense amount is required.' });
    }
    const numericAmount = Number(total_amount);
    if (isNaN(numericAmount)) {
      return res.status(400).json({ error: 'Expense amount must be a valid number.' });
    }
    if (numericAmount <= 0) {
      return res.status(400).json({ error: 'Expense amount must be greater than zero.' });
    }
    if (!receipt_url) return res.status(400).json({ error: 'Receipt image or PDF is required.' });

    itemsToCreate.push({
      category: normalizeExpenseCategory(expense_category),
      amount: numericAmount,
      receipt_url: receipt_url,
      or_number: or_number,
      expense_date,
      business_purpose: remarks ||
        (isTransportReimbursement ? 'Business transport reimbursement' : `Sales reimbursement for meeting with ${mom?.client || 'client'}`)
    });
    claimTotal = numericAmount;
    mainCategory = normalizeExpenseCategory(expense_category);
    mainReceipt = receipt_url;
  }

  const policyError = checkCategoryLimits(itemsToCreate);
  if (policyError) return res.status(400).json({ error: policyError });

  let unlinkedOldMom: Mom | undefined;
  if (claim.mom_id !== mom_id) {
    unlinkedOldMom = state.moms.find(m => m.id === claim.mom_id);
    if (unlinkedOldMom) unlinkedOldMom.claim_id = undefined;
  }
  if (mom) mom.claim_id = claim.id;

  for (let i = state.expenses.length - 1; i >= 0; i--) {
    if (state.expenses[i].claim_id === claim.id) {
      state.expenses.splice(i, 1);
    }
  }
  for (const item of itemsToCreate) {
    state.expenses.push({
      id: uuidv4(),
      claim_id: claim.id,
      expense_date: item.expense_date || mom?.meeting_date || new Date().toISOString().split('T')[0],
      vendor: item.vendor || mom?.client || (isTransportReimbursement ? 'Transport Provider' : 'Client Meeting'),
      category: item.category,
      amount: item.amount,
      payment_method: item.payment_method || 'Cash',
      business_purpose: item.business_purpose,
      receipt_url: item.receipt_url,
      or_number: item.or_number
    });
  }

  const oldStatus = claim.status;
  claim.mom_id = mom_id || undefined;
  claim.claim_type = claimType;
  claim.expense_category = mainCategory;
  claim.total_amount = claimTotal;
  claim.approved_amount = undefined;
  claim.paid_amount = undefined;
  claim.approved_at = undefined;
  claim.paid_at = undefined;
  claim.receipt_url = mainReceipt;
  claim.remarks = remarks;
  claim.supporting_documents = supporting_documents;
  claim.status = ClaimStatus.PENDING_APPROVAL;
  claim.updated_at = new Date().toISOString();
  claim.flagged_high_value = itemsToCreate.some(item => item.amount > state.systemSettings.highValueThreshold);

  addHistory(claim.id, oldStatus, ClaimStatus.PENDING_APPROVAL, user.id, 'Revised and resubmitted by requestor after being returned');

  const claimNumber = claim.claim_number || `REIM-${claim.id.substring(0, 6)}`;

  if (claim.current_approver_id) {
    const approverName = state.users.find(u => u.id === claim.current_approver_id)?.name || 'Approver';

    const emailSubject = `Reimbursement Resubmitted - ${claimNumber}`;
    const emailBody = `A previously returned reimbursement request ${claimNumber} by ${user.name} has been revised and resubmitted, and is awaiting your review and approval.

Reference:
${claimNumber}

Required Action:
Please log in to the system and navigate to the Approval Queue to approve or reject this claim.`;
    sendEmail(claim.current_approver_id, emailSubject, emailBody, undefined, { eventKey: 'submitted' });

    sendEmail(
      user.id,
      `Reimbursement Resubmitted - ${claimNumber}`,
      `Your revised reimbursement claim ${claimNumber} has been successfully resubmitted and routed to ${approverName} for review.

Reference:
${claimNumber}

You'll receive another email as soon as ${approverName} makes a decision.`,
      undefined,
      { eventKey: 'submitted' }
    );
  }

  try {
    const momsToBackfill = [unlinkedOldMom, mom].filter((m): m is NonNullable<typeof m> => !!m);
    await persistClaimWithLineItems(claim, state.expenses.filter(e => e.claim_id === claim.id), momsToBackfill);
  } catch (err) {
    console.error('[db] Could not persist resubmitted claim to Postgres:', err);
  }
  res.json(claim);
});

claimsRouter.post('/claims/:id/approve', async (req, res) => {
  const user = getUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const claim = state.claims.find(c => c.id === req.params.id);
  if (!claim) return res.status(404).json({ error: 'Not found' });

  if (claim.requestor_id === user.id) {
    return res.status(403).json({ error: 'Segregation of Duties: You cannot approve your own reimbursement claim.' });
  }

  const requestor = state.users.find(u => u.id === claim.requestor_id);
  if (
    claim.current_approver_id !== user.id &&
    claim.original_approver_id !== user.id &&
    !isActiveDelegateFor(user.id, claim.current_approver_id)
  ) {
    return res.status(403).json({ error: 'Not your direct report' });
  }

  if (claim.status !== ClaimStatus.PENDING_APPROVAL) {
    return res.status(409).json({ error: `This claim is "${claim.status}" and is no longer awaiting an approval decision.` });
  }

  const { decision, comment, review_meeting_date, review_meeting_time } = req.body;
  if (!['Approved', 'Rejected', 'Returned'].includes(decision)) return res.status(400).json({ error: 'Invalid decision' });
  if ((decision === 'Rejected' || decision === 'Returned') && !comment) {
    return res.status(400).json({ error: 'Comment required' });
  }
  if (Boolean(review_meeting_date) !== Boolean(review_meeting_time)) {
    return res.status(400).json({ error: 'Provide both a review meeting date and time, or leave both blank.' });
  }
  if (review_meeting_date && decision === 'Approved') {
    return res.status(400).json({ error: 'A review meeting can only be scheduled when returning or rejecting a claim.' });
  }
  if (review_meeting_date) {
    const hasConflict = state.reviewMeetings.some(rm =>
      rm.approver_id === user.id &&
      [ReviewMeetingStatus.PENDING_CONFIRMATION, ReviewMeetingStatus.CONFIRMED].includes(rm.status) &&
      rm.meeting_date === review_meeting_date &&
      rm.meeting_time === review_meeting_time
    );
    if (hasConflict) {
      return res.status(409).json({ error: 'You already have a review meeting scheduled at that date and time.' });
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
  state.approvals.push(newApproval);

  addHistory(claim.id, oldStatus, newStatus, user.id, comment || undefined);

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
    state.reviewMeetings.push(newReviewMeeting);
    addHistory(
      claim.id,
      newStatus,
      newStatus,
      user.id,
      `Review meeting scheduled for ${review_meeting_date} at ${review_meeting_time}`
    );
  }

  const claimNumber = claim.claim_number || `REIM-${claim.id.substring(0,6)}`;

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

    const custodians = state.users.filter(u => u.role === UserRole.CUSTODIAN);
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

  const claimMom = claim.mom_id ? state.moms.find(candidate => candidate.id === claim.mom_id) : undefined;
  if (claimMom?.cc_client && claimMom.contact_person_email) {
    sendEmail(
      claimMom.contact_person_email,
      `Copy: Reimbursement ${decision} - ${claimNumber}`,
      `${claimNumber}, filed by ${requestor?.name || 'the requestor'}, was ${decision.toLowerCase()}.${comment ? `\n\nComment: ${comment}` : ''}`,
      undefined,
      { plain: true, recipientName: claimMom.contact_person || undefined, fromLabel: `${user.name} via Sales Reimbursement System` }
    );
    notifyClientCcSent({
      recipientIds: [claim.requestor_id, user.id],
      claimNumber,
      clientName: claimMom.contact_person,
      clientEmail: claimMom.contact_person_email,
      eventLabel: decision,
    });
  }

  try {
    await persistClaim(claim);
    await insertApproval(newApproval);
    if (newReviewMeeting) await persistReviewMeeting(newReviewMeeting);
  } catch (err) {
    console.error('[db] Could not persist approval decision to Postgres:', err);
  }

  res.json(claim);
});

claimsRouter.post('/claims/:id/transfer-approver', async (req, res) => {
  const user = getUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const claim = state.claims.find(c => c.id === req.params.id);
  if (!claim) return res.status(404).json({ error: 'Not found' });

  const isCurrentApprover = claim.current_approver_id === user.id;
  const isAdmin = user.role === UserRole.ADMIN;
  if (!isCurrentApprover && !isAdmin) return res.status(403).json({ error: 'Forbidden' });

  const targetApproverId = req.body?.to || claim.pending_transfer_to;
  if (!targetApproverId) return res.status(400).json({ error: 'No target approver specified.' });
  const newApprover = state.users.find(u => u.id === targetApproverId);
  if (!newApprover) return res.status(404).json({ error: 'Target approver not found.' });

  const oldApprover = state.users.find(u => u.id === claim.current_approver_id);
  const claimNumber = claim.claim_number || `REIM-${claim.id.substring(0, 6)}`;

  claim.current_approver_id = targetApproverId;
  claim.approver_stale_since = null;
  claim.pending_transfer_to = null;
  claim.approver_stale_reason = undefined;
  claim.escalated_to_admin = false;
  claim.updated_at = new Date().toISOString();

  addHistory(claim.id, claim.status, claim.status, user.id,
    `Approver transferred from ${oldApprover?.name || '(unknown)'} to ${newApprover.name} — org change`);

  sendEmail(targetApproverId, `Reimbursement now assigned to you - ${claimNumber}`,
    `${claimNumber} has been transferred to you for review following an organizational change.`);

  try {
    await persistClaim(claim);
  } catch (err) {
    console.error('[db] Could not persist approver transfer to Postgres:', err);
  }
  res.json(claim);
});

claimsRouter.post('/custodian/claims/:id/decision', async (req, res) => {
  const user = getUser(req);
  if (!user || user.role !== UserRole.CUSTODIAN) {
    return res.status(403).json({ error: 'Forbidden: Only Custodians can make processing decisions.' });
  }

  const { decision, comment } = req.body as { decision?: 'Return' | 'Reject'; comment?: string };
  if (decision !== 'Return' && decision !== 'Reject') {
    return res.status(400).json({ error: 'Decision must be Return or Reject.' });
  }
  if (!comment?.trim()) {
    return res.status(400).json({ error: 'A reason is required so the requestor and audit trail are clear.' });
  }

  const claim = state.claims.find(item => item.id === req.params.id);
  const cashAdvance = state.cashAdvances.find(item => item.id === req.params.id);
  const liquidation = state.liquidations.find(item => item.id === req.params.id);
  const now = new Date().toISOString();

  if (claim) {
    if (![ClaimStatus.APPROVED, ClaimStatus.PROCESSING].includes(claim.status)) {
      return res.status(400).json({ error: 'Only approved or processing reimbursements can be returned or rejected by the Custodian.' });
    }
    const oldStatus = claim.status;
    const newStatus = decision === 'Return' ? ClaimStatus.RETURNED : ClaimStatus.REJECTED;
    claim.status = newStatus;
    claim.updated_at = now;
    claim.processing_date = undefined;
    claim.processed_by = undefined;
    claim.release_code = undefined;
    claim.release_code_expires_at = undefined;
    claim.release_code_attempts = 0;
    claim.release_code_locked_until = undefined;
    addHistory(claim.id, oldStatus, newStatus, user.id, `Custodian ${decision.toLowerCase()}: ${comment.trim()}`);

    const claimNumber = claim.claim_number || `REIM-${claim.id.substring(0, 6)}`;
    sendEmail(
      claim.requestor_id,
      `Reimbursement ${decision === 'Return' ? 'Returned for Revision' : 'Rejected'} - ${claimNumber}`,
      `${user.name} ${decision === 'Return' ? 'returned' : 'rejected'} ${claimNumber} during payment processing.\n\nReason: ${comment.trim()}`
    );
    if (claim.current_approver_id) {
      sendEmail(
        claim.current_approver_id,
        `Custodian ${decision} - ${claimNumber}`,
        `${user.name} ${decision.toLowerCase()}ed ${claimNumber} during payment processing.\n\nReason: ${comment.trim()}`
      );
    }
    try {
      await persistClaim(claim);
    } catch (err) {
      console.error('[db] Could not persist custodian decision to Postgres:', err);
    }
    return res.json(claim);
  }

  if (cashAdvance) {
    if (decision !== 'Reject') {
      return res.status(400).json({ error: 'Approved Cash Advances can be rejected before release, but they do not have a return-for-revision state.' });
    }
    if (cashAdvance.status !== CashAdvanceStatus.APPROVED) {
      return res.status(400).json({ error: 'Only an Approved Cash Advance can be rejected before release.' });
    }
    const oldStatus = cashAdvance.status;
    cashAdvance.status = CashAdvanceStatus.REJECTED;
    addCaHistory(cashAdvance.id, oldStatus, CashAdvanceStatus.REJECTED, user.id, `Custodian rejected before release: ${comment.trim()}`);
    sendEmail(
      cashAdvance.requestorId,
      `Cash Advance Rejected - CADV-${cashAdvance.id.substring(0, 6)}`,
      `${user.name} rejected this Cash Advance before funds were released.\n\nReason: ${comment.trim()}`
    );
    try {
      await persistCashAdvance(cashAdvance);
    } catch (err) {
      console.error('[db] Could not persist custodian cash advance decision to Postgres:', err);
    }
    return res.json(cashAdvance);
  }

  if (liquidation) {
    if (decision !== 'Return') {
      return res.status(400).json({ error: 'A reviewed Liquidation can be returned for correction, but it cannot be rejected after the Cash Advance was released.' });
    }
    if (liquidation.status !== LiquidationStatus.REVIEWED || liquidation.varianceType !== 'RefundDue') {
      return res.status(400).json({ error: 'Only a reviewed Liquidation awaiting refund collection can be returned.' });
    }
    const oldStatus = liquidation.status;
    liquidation.status = LiquidationStatus.RETURNED_FOR_REVISION;
    addLiqHistory(liquidation.id, oldStatus, LiquidationStatus.RETURNED_FOR_REVISION, user.id, `Custodian returned before refund collection: ${comment.trim()}`);
    sendEmail(
      liquidation.requestorId,
      `Liquidation Returned - LIQ-${liquidation.id.substring(0, 6)}`,
      `${user.name} returned this Liquidation for correction before refund collection.\n\nReason: ${comment.trim()}`
    );
    try {
      await persistLiquidation(liquidation);
    } catch (err) {
      console.error('[db] Could not persist custodian liquidation decision to Postgres:', err);
    }
    return res.json(liquidation);
  }

  return res.status(404).json({ error: 'Processing record not found.' });
});

claimsRouter.put('/claims/:id/claim-code', async (req, res) => {
  const user = getUser(req);
  if (!user || user.role !== UserRole.CUSTODIAN) return res.status(403).json({ error: 'Forbidden' });

  const claim = state.claims.find(c => c.id === req.params.id);
  if (!claim) return res.status(404).json({ error: 'Claim not found' });

  if (![ClaimStatus.PROCESSING, ClaimStatus.READY_FOR_CLAIM].includes(claim.status)) {
    return res.status(409).json({ error: `A claim code can only be generated for a claim in Processing or Ready for Claim (this one is "${claim.status}").` });
  }

  const { code } = req.body;
  const isRegen = !!claim.release_code;
  claim.release_code = code || generateReleaseCode();
  resetReleaseCodeSecurity(claim);

  addHistory(claim.id, claim.status, claim.status, user.id, isRegen ? `Regenerated Claim Code to ${claim.release_code}` : `Generated Claim Code ${claim.release_code}`);

  try {
    await persistClaim(claim);
  } catch (err) {
    console.error('[db] Could not persist claim code to Postgres:', err);
  }
  res.json(claim);
});

claimsRouter.post('/claims/:id/ready-for-claim', async (req, res) => {
  const user = getUser(req);
  if (!user || user.role !== UserRole.CUSTODIAN) return res.status(403).json({ error: 'Forbidden' });

  const claim = state.claims.find(c => c.id === req.params.id);
  if (!claim) return res.status(404).json({ error: 'Claim not found' });

  if (claim.status !== ClaimStatus.PROCESSING) {
    return res.status(409).json({ error: `Only a claim in Processing can be marked Ready for Claim (this one is "${claim.status}").` });
  }

  if (!claim.release_code) {
    claim.release_code = generateReleaseCode();
    resetReleaseCodeSecurity(claim);
  }

  const { payment_method } = req.body;
  const isReimbursement = claim.claim_type === 'Reimbursement' || claim.claim_type === 'Transport Reimbursement';
  if (isReimbursement && payment_method !== 'Cash') {
    return res.status(400).json({ error: 'Reimbursements are released in cash only.' });
  }
  if (!isReimbursement && (!payment_method || !state.systemSettings.paymentMethods.includes(payment_method))) {
    return res.status(400).json({ error: `Payment method must be one of: ${state.systemSettings.paymentMethods.join(', ')}` });
  }
  claim.payment_method = payment_method;
  claim.processed_by = user.id;

  const oldStatus = claim.status;
  claim.status = ClaimStatus.READY_FOR_CLAIM;
  claim.processing_date = new Date().toISOString();
  claim.paid_at = claim.processing_date;
  claim.paid_amount = claim.approved_amount ?? claim.total_amount;
  claim.updated_at = new Date().toISOString();

  addHistory(claim.id, oldStatus, ClaimStatus.READY_FOR_CLAIM, user.id);

  const requestor = state.users.find(u => u.id === claim.requestor_id);
  const claimNumber = claim.claim_number || `REIM-${claim.id.substring(0,6)}`;

  const emailSubject = `Reimbursement - For Release`;
  const emailBody = `This request ${claimNumber} by ${requestor?.name || 'Requestor'} has been approved and ready for release.

Enter code ${claim.release_code} for releasing of cash.
_________________________________________
This is an automatically generated email, please do not reply.
${requestor?.name || 'Requestor'}
BSM Assistant | BSD - IT Security Business`;

  sendEmail(claim.requestor_id, emailSubject, emailBody, undefined, {
    plain: true,
    fromLabel: "SharePoint Online <no-reply@sharepointonline.com>",
    eventKey: 'ready',
  });

  try {
    await persistClaim(claim);
  } catch (err) {
    console.error('[db] Could not persist ready-for-claim to Postgres:', err);
  }
  res.json(claim);
});

claimsRouter.post('/claims/:id/claim', async (req, res) => {
  const user = getUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const claim = state.claims.find(c => c.id === req.params.id && c.requestor_id === user.id);
  if (!claim) return res.status(404).json({ error: 'Claim not found' });

  if (claim.status !== ClaimStatus.READY_FOR_CLAIM) {
    return res.status(400).json({ error: 'Claim is not ready for claiming.' });
  }

  const { code } = req.body;
  if (!code) {
    return res.status(400).json({ error: 'Incorrect Claim Code' });
  }

  if (claim.release_code_locked_until && new Date(claim.release_code_locked_until) > new Date()) {
    const minutesLeft = Math.max(1, Math.ceil((new Date(claim.release_code_locked_until).getTime() - Date.now()) / 60000));
    return res.status(429).json({ error: `Too many incorrect attempts. Try again in ${minutesLeft} minute${minutesLeft === 1 ? '' : 's'}, or ask your custodian to regenerate the code.` });
  }

  if (claim.release_code_expires_at && new Date(claim.release_code_expires_at) < new Date()) {
    return res.status(400).json({ error: 'This claim code has expired. Ask your custodian to regenerate it.' });
  }

  if (!claim.release_code || !timingSafeCodeEquals(code, claim.release_code)) {
    claim.release_code_attempts = (claim.release_code_attempts || 0) + 1;
    if (claim.release_code_attempts >= RELEASE_CODE_MAX_ATTEMPTS) {
      claim.release_code_locked_until = new Date(Date.now() + RELEASE_CODE_LOCKOUT_MINUTES * 60 * 1000).toISOString();
    }
    try {
      await persistClaim(claim);
    } catch (err) {
      console.error('[db] Could not persist release-code attempt to Postgres:', err);
    }
    return res.status(400).json({ error: 'Incorrect Claim Code' });
  }

  claim.release_code_attempts = 0;
  claim.release_code_locked_until = undefined;

  const oldStatus = claim.status;
  claim.status = ClaimStatus.COMPLETED;
  claim.updated_at = new Date().toISOString();

  addHistory(claim.id, oldStatus, ClaimStatus.COMPLETED, user.id);

  if (claim.sourceLiquidationId) {
    addLiqHistory(claim.sourceLiquidationId, LiquidationStatus.CLOSED, LiquidationStatus.CLOSED, user.id, 'Reimbursement Processed');
  }

  const claimNumber = claim.claim_number || `REIM-${claim.id.substring(0, 6)}`;
  if (claim.processed_by) {
    sendEmail(
      claim.processed_by,
      `Reimbursement Completed - ${claimNumber}`,
      `${user.name} has confirmed receipt of the payout for ${claimNumber} (PHP ${claim.total_amount}). The claim is now complete — no further action is required.`
    );
  }
  sendEmail(
    claim.requestor_id,
    `Reimbursement Completed - ${claimNumber}`,
    `You've confirmed receipt of your reimbursement ${claimNumber} (PHP ${claim.total_amount}). This claim is now complete.`
  );

  try {
    await persistClaim(claim);
  } catch (err) {
    console.error('[db] Could not persist claim completion to Postgres:', err);
  }
  res.json(claim);
});

claimsRouter.put('/claims/:id/reassign', async (req, res) => {
  const user = getUser(req);
  if (!user || user.role !== UserRole.ADMIN) return res.status(403).json({ error: 'Forbidden' });

  const { new_approver_id, reason } = req.body;
  if (!new_approver_id || !reason) return res.status(400).json({ error: 'Missing required fields' });

  const newApprover = state.users.find(u => u.id === new_approver_id);
  if (!newApprover) return res.status(400).json({ error: 'New approver not found.' });
  if (newApprover.role !== UserRole.APPROVER) return res.status(400).json({ error: 'New approver must have the Approver role.' });

  const claim = state.claims.find(c => c.id === req.params.id);
  if (!claim) return res.status(404).json({ error: 'Claim not found' });

  const oldApproverId = claim.current_approver_id;
  const oldApproverName = state.users.find(u => u.id === oldApproverId)?.name || oldApproverId;
  const newApproverName = state.users.find(u => u.id === new_approver_id)?.name || new_approver_id;

  claim.current_approver_id = new_approver_id;
  claim.approver_stale_since = null;
  claim.pending_transfer_to = null;
  claim.approver_stale_reason = undefined;
  claim.escalated_to_admin = false;
  claim.updated_at = new Date().toISOString();

  addHistory(claim.id, claim.status, claim.status, user.id,
    `Admin reassigned from ${oldApproverName} to ${newApproverName}. Reason: ${reason}`);

  try {
    await persistClaim(claim);
  } catch (err) {
    console.error('[db] Could not persist admin reassignment to Postgres:', err);
  }
  res.json(claim);
});
