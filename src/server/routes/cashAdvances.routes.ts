import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { CashAdvance, CashAdvanceStatus, UserRole, MomStatus } from '../../serverTypes';
import { state } from '../state';
import { getUser } from '../middleware/auth';
import { isActiveDelegateFor, getActiveDelegation } from '../services/delegations';
import { addCaHistory } from '../services/history';
import { sendEmail } from '../services/notifications';
import { isFinanceVisibleFinancialRecord, LIQUIDATION_DEADLINE_DAYS } from '../constants';
import { isClaimTypeEnabled, COMING_SOON_MESSAGE } from '../../lib/featureFlags';
import { persistCashAdvance } from '../../db/cashAdvanceRepo';

export const cashAdvancesRouter = Router();

// 1. Get all cash advances
cashAdvancesRouter.get('/cash-advances', (req, res) => {
  const user = getUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  let filtered: CashAdvance[] = [];
  if (user.role === UserRole.REQUESTOR) {
    filtered = state.cashAdvances.filter(ca => ca.requestorId === user.id);
  } else if (user.role === UserRole.APPROVER) {
    const reporteeIds = state.users.filter(u => u.reports_to === user.id).map(u => u.id);
    filtered = state.cashAdvances.filter(ca => ca.approverId === user.id || ca.requestorId === user.id || reporteeIds.includes(ca.requestorId) || isActiveDelegateFor(user.id, ca.approverId));
  } else if (user.role === UserRole.FINANCE) {
    filtered = state.cashAdvances.filter(ca => isFinanceVisibleFinancialRecord('Cash Advance', ca.status));
  } else {
    filtered = state.cashAdvances; // Custodian and Admin see all
  }

  const enriched = filtered.map(ca => {
    const requestor = state.users.find(u => u.id === ca.requestorId);
    const approver = state.users.find(u => u.id === ca.approverId);
    const mom = ca.momId ? state.moms.find(m => m.id === ca.momId) : undefined;
    const history = state.statusHistories
      .filter(h => h.cash_advance_id === ca.id)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return { ...ca, requestor, approver, mom, history };
  });
  res.json(enriched);
});

// 2. Get single cash advance
cashAdvancesRouter.get('/cash-advances/:id', (req, res) => {
  const user = getUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const ca = state.cashAdvances.find(c => c.id === req.params.id);
  if (!ca) return res.status(404).json({ error: 'Cash Advance not found' });

  let hasAccess = false;
  if (user.role === UserRole.REQUESTOR) {
    hasAccess = ca.requestorId === user.id;
  } else if (user.role === UserRole.APPROVER) {
    const reporteeIds = state.users.filter(u => u.reports_to === user.id).map(u => u.id);
    hasAccess = ca.approverId === user.id || ca.requestorId === user.id || reporteeIds.includes(ca.requestorId) || isActiveDelegateFor(user.id, ca.approverId);
  } else if (user.role === UserRole.FINANCE) {
    hasAccess = isFinanceVisibleFinancialRecord('Cash Advance', ca.status);
  } else {
    hasAccess = true; // Custodian and Admin see all
  }
  if (!hasAccess) return res.status(403).json({ error: 'Forbidden' });

  const requestor = state.users.find(u => u.id === ca.requestorId);
  const approver = state.users.find(u => u.id === ca.approverId);
  const mom = ca.momId ? state.moms.find(m => m.id === ca.momId) : undefined;

  const history = state.statusHistories
    .filter(h => h.cash_advance_id === ca.id)
    .map(h => ({
      ...h,
      changedBy: state.users.find(u => u.id === h.changed_by)
    }))
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  res.json({ ...ca, requestor, approver, mom, history });
});

// 3. Create a cash advance request
cashAdvancesRouter.post('/cash-advances', async (req, res) => {
  const user = getUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  if (!isClaimTypeEnabled('Cash Advance')) return res.status(403).json({ error: COMING_SOON_MESSAGE });
  if (!user.reports_to) return res.status(403).json({ error: 'Forbidden: You must have a designated manager (reports_to) to submit.' });

  const hasActive = state.cashAdvances.some(ca => ca.requestorId === user.id && ca.status !== CashAdvanceStatus.LIQUIDATED && ca.status !== CashAdvanceStatus.REJECTED);
  if (hasActive) {
    return res.status(400).json({ error: 'A requestor may only have one active (unliquidated) Cash Advance at a time. Please liquidate or resolve your current open Cash Advance before requesting a new one.' });
  }

  const { amount, purpose, momId } = req.body;
  if (amount === undefined || amount === null || amount === '') {
    return res.status(400).json({ error: 'Amount is required.' });
  }
  const numericAmount = Number(amount);
  if (isNaN(numericAmount) || numericAmount <= 0) {
    return res.status(400).json({ error: 'Amount must be a valid positive number.' });
  }
  if (!purpose) {
    return res.status(400).json({ error: 'Purpose is required.' });
  }

  if (momId) {
    const mom = state.moms.find(m => m.id === momId);
    if (!mom) return res.status(400).json({ error: 'Minutes of Meeting (MOM) not found.' });
    if (mom.status !== MomStatus.COMPLETED) {
      return res.status(400).json({ error: 'Cannot attach an incomplete or draft Minutes of Meeting.' });
    }
  }

  const caId = uuidv4();
  const cashAdvance: CashAdvance = {
    id: caId,
    requestorId: user.id,
    amount: numericAmount,
    purpose,
    momId,
    approverId: user.reports_to,
    status: CashAdvanceStatus.DRAFT,
    createdAt: new Date().toISOString()
  };

  state.cashAdvances.push(cashAdvance);
  try {
    await persistCashAdvance(cashAdvance);
  } catch (err) {
    console.error('[db] Could not persist new cash advance to Postgres:', err);
  }
  addCaHistory(caId, '', CashAdvanceStatus.DRAFT, user.id, 'Cash Advance Draft Created');
  res.json(cashAdvance);
});

// 4. Update cash advance in Draft or Rejected status
cashAdvancesRouter.put('/cash-advances/:id', async (req, res) => {
  const user = getUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const ca = state.cashAdvances.find(c => c.id === req.params.id);
  if (!ca) return res.status(404).json({ error: 'Cash Advance not found' });

  const { amount, purpose, momId } = req.body;

  if ([CashAdvanceStatus.RELEASED, CashAdvanceStatus.LIQUIDATED].includes(ca.status)) {
    if (user.role !== UserRole.ADMIN) {
      return res.status(403).json({ error: 'This Cash Advance has already been released/liquidated. Its amount, purpose, and MOM are locked and can only be modified by an Admin.' });
    }
  }

  if (amount !== undefined) {
    const numericAmount = Number(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      return res.status(400).json({ error: 'Amount must be a valid positive number.' });
    }
    ca.amount = numericAmount;
  }

  if (purpose !== undefined) {
    if (!purpose) return res.status(400).json({ error: 'Purpose cannot be empty.' });
    ca.purpose = purpose;
  }

  if (momId !== undefined) {
    if (momId) {
      const mom = state.moms.find(m => m.id === momId);
      if (!mom) return res.status(400).json({ error: 'Minutes of Meeting (MOM) not found.' });
      if (mom.status !== MomStatus.COMPLETED) {
        return res.status(400).json({ error: 'Cannot attach an incomplete or draft Minutes of Meeting.' });
      }
    }
    ca.momId = momId || undefined;
  }

  try {
    await persistCashAdvance(ca);
  } catch (err) {
    console.error('[db] Could not persist cash advance changes to Postgres:', err);
  }
  res.json(ca);
});

// 5. Submit Cash Advance
cashAdvancesRouter.post('/cash-advances/:id/submit', async (req, res) => {
  const user = getUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const ca = state.cashAdvances.find(c => c.id === req.params.id && c.requestorId === user.id);
  if (!ca) return res.status(404).json({ error: 'Cash Advance not found' });

  if (ca.status !== CashAdvanceStatus.DRAFT && ca.status !== CashAdvanceStatus.REJECTED) {
    return res.status(400).json({ error: 'Only Cash Advances in Draft or Rejected status can be submitted.' });
  }

  const oldStatus = ca.status;
  ca.status = CashAdvanceStatus.SUBMITTED;
  addCaHistory(ca.id, oldStatus, CashAdvanceStatus.SUBMITTED, user.id, 'Cash Advance Submitted for Approval');

  if (user.reports_to) {
    const activeDelegation = getActiveDelegation(user.reports_to);
    ca.approverId = activeDelegation ? activeDelegation.delegate_id : user.reports_to;
  }

  const approver = state.users.find(u => u.id === ca.approverId);
  if (approver) {
    sendEmail(
      ca.approverId,
      `Cash Advance Request Submitted - CADV-${ca.id.substring(0,6)}`,
      `A Cash Advance request for PHP ${ca.amount} has been submitted by ${user.name} for your approval.\n\nPurpose: ${ca.purpose}`
    );
  }

  sendEmail(
    user.id,
    `Cash Advance Request Submitted - CADV-${ca.id.substring(0,6)}`,
    `Your Cash Advance request for PHP ${ca.amount} has been successfully submitted${approver ? ` and routed to ${approver.name} for approval` : ''}.

Purpose: ${ca.purpose}

You'll receive another email as soon as a decision is made.`
  );

  try {
    await persistCashAdvance(ca);
  } catch (err) {
    console.error('[db] Could not persist cash advance submission to Postgres:', err);
  }
  res.json(ca);
});

// 6. Approve or Reject Cash Advance
cashAdvancesRouter.post('/cash-advances/:id/approve', async (req, res) => {
  const user = getUser(req);
  if (!user || user.role !== UserRole.APPROVER) return res.status(403).json({ error: 'Forbidden' });

  const ca = state.cashAdvances.find(c => c.id === req.params.id);
  if (!ca) return res.status(404).json({ error: 'Cash Advance not found' });

  if (ca.approverId !== user.id && !isActiveDelegateFor(user.id, ca.approverId)) {
    return res.status(403).json({ error: 'You are not the designated approver for this Cash Advance.' });
  }

  if (ca.status !== CashAdvanceStatus.SUBMITTED) {
    return res.status(400).json({ error: 'Only Submitted Cash Advances can be approved or rejected.' });
  }

  const { decision, comment } = req.body;
  if (!['Approved', 'Rejected'].includes(decision)) {
    return res.status(400).json({ error: 'Invalid decision. Must be Approved or Rejected.' });
  }

  if (decision === 'Rejected' && !comment) {
    return res.status(400).json({ error: 'A comment is required when rejecting a Cash Advance.' });
  }

  const oldStatus = ca.status;
  const newStatus = decision === 'Approved' ? CashAdvanceStatus.APPROVED : CashAdvanceStatus.REJECTED;
  ca.status = newStatus;
  if (decision === 'Approved') {
    ca.approvedAt = new Date().toISOString();
  } else {
    ca.approvedAt = undefined;
    ca.paidAmount = undefined;
  }
  addCaHistory(ca.id, oldStatus, newStatus, user.id, comment || `Cash Advance ${decision}`);

  sendEmail(
    ca.requestorId,
    `Cash Advance Request ${decision} - CADV-${ca.id.substring(0,6)}`,
    `Your Cash Advance request for PHP ${ca.amount} has been ${decision} by ${user.name}.${comment ? `\n\nComment: ${comment}` : ''}`
  );

  try {
    await persistCashAdvance(ca);
  } catch (err) {
    console.error('[db] Could not persist cash advance decision to Postgres:', err);
  }
  res.json(ca);
});

// 7. Release Cash Advance (Custodian only)
cashAdvancesRouter.post('/cash-advances/:id/release', async (req, res) => {
  const user = getUser(req);
  if (!user || user.role !== UserRole.CUSTODIAN) return res.status(403).json({ error: 'Forbidden: Only Custodians can release Cash Advances.' });

  const ca = state.cashAdvances.find(c => c.id === req.params.id);
  if (!ca) return res.status(404).json({ error: 'Cash Advance not found' });

  if (ca.status !== CashAdvanceStatus.APPROVED) {
    return res.status(400).json({ error: 'Only Approved Cash Advances can be released.' });
  }

  const { releaseReference, releaseMethod } = req.body;
  if (!releaseReference) {
    return res.status(400).json({ error: 'Release Reference/Voucher is required.' });
  }
  if (!releaseMethod || !state.systemSettings.paymentMethods.includes(releaseMethod)) {
    return res.status(400).json({ error: `Release method must be one of: ${state.systemSettings.paymentMethods.join(', ')}` });
  }

  const oldStatus = ca.status;
  ca.status = CashAdvanceStatus.RELEASED;
  ca.releasedBy = user.id;
  ca.releaseDate = new Date().toISOString();
  ca.paidAmount = ca.amount;
  ca.releaseReference = releaseReference;
  ca.releaseMethod = releaseMethod;
  addCaHistory(ca.id, oldStatus, CashAdvanceStatus.RELEASED, user.id, `Released via ${releaseMethod} with Voucher Reference: ${releaseReference}`);

  sendEmail(
    ca.requestorId,
    `Cash Advance Released - CADV-${ca.id.substring(0,6)}`,
    `Your Cash Advance for PHP ${ca.amount} has been released by ${user.name}.\n\nRelease Reference: ${releaseReference}\n\nPlease file your liquidation within ${LIQUIDATION_DEADLINE_DAYS} days.`
  );

  try {
    await persistCashAdvance(ca);
  } catch (err) {
    console.error('[db] Could not persist cash advance release to Postgres:', err);
  }
  res.json(ca);
});
