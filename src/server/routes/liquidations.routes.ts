import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import {
  Liquidation, LiquidationStatus, LiquidationVarianceType, LiquidationLineItem,
  CashAdvanceStatus, Claim, ClaimStatus, UserRole
} from '../../serverTypes';
import { state, checkCategoryLimits } from '../state';
import { getUser } from '../middleware/auth';
import { canAccessLiquidation } from '../services/authorization';
import { isActiveDelegateFor } from '../services/delegations';
import { generateClaimNumber } from '../services/claimNumber';
import { addHistory, addCaHistory, addLiqHistory } from '../services/history';
import { sendEmail } from '../services/notifications';
import { normalizeExpenseCategory } from '../../lib/expenseCategories';
import { isFinanceVisibleFinancialRecord, REIMBURSEMENT_CAP } from '../constants';
import { isClaimTypeEnabled, COMING_SOON_MESSAGE } from '../../lib/featureFlags';
import { persistLiquidation, persistLiquidationLineItems, persistCashAdvance } from '../../db/cashAdvanceRepo';
import { persistClaim, persistClaimWithLineItems, persistExpenseLineItems } from '../../db/coreLoopRepo';

export const liquidationsRouter = Router();

export const recalculateLiquidation = async (liquidationId: string) => {
  const liq = state.liquidations.find(l => l.id === liquidationId);
  if (!liq) return;
  const ca = state.cashAdvances.find(c => c.id === liq.cashAdvanceId);
  if (!ca) return;

  const items = state.liquidationLineItems.filter(item => item.liquidationId === liquidationId);
  const totalSpent = items.reduce((sum, item) => sum + item.amount, 0);
  const varianceAmount = totalSpent - ca.amount;

  liq.totalSpent = totalSpent;
  liq.varianceAmount = varianceAmount;
  if (varianceAmount === 0) {
    liq.varianceType = LiquidationVarianceType.SETTLED;
  } else if (varianceAmount < 0) {
    liq.varianceType = LiquidationVarianceType.REFUND_DUE;
  } else {
    liq.varianceType = LiquidationVarianceType.REIMBURSEMENT_DUE;
  }

  try {
    await persistLiquidation(liq);
    await persistLiquidationLineItems(liquidationId, items);
  } catch (err) {
    console.error('[db] Could not persist recalculated liquidation to Postgres:', err);
  }
};

// 8. Get all liquidations
liquidationsRouter.get('/liquidations', (req, res) => {
  const user = getUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  let filtered: Liquidation[] = [];
  if (user.role === UserRole.REQUESTOR) {
    filtered = state.liquidations.filter(l => l.requestorId === user.id);
  } else if (user.role === UserRole.APPROVER) {
    const reporteeIds = state.users.filter(u => u.reports_to === user.id).map(u => u.id);
    filtered = state.liquidations.filter(l => {
      const ca = state.cashAdvances.find(ca => ca.id === l.cashAdvanceId);
      const approverId = ca?.approverId;
      return l.requestorId === user.id || approverId === user.id || reporteeIds.includes(l.requestorId) || isActiveDelegateFor(user.id, approverId);
    });
  } else if (user.role === UserRole.FINANCE) {
    filtered = state.liquidations.filter(l => isFinanceVisibleFinancialRecord('Liquidation', l.status));
  } else {
    filtered = state.liquidations; // Custodian and Admin see all
  }

  const enriched = filtered.map(l => {
    const requestor = state.users.find(u => u.id === l.requestorId);
    const cashAdvance = state.cashAdvances.find(c => c.id === l.cashAdvanceId);
    const items = state.liquidationLineItems.filter(item => item.liquidationId === l.id);
    const mom = cashAdvance?.momId ? state.moms.find(m => m.id === cashAdvance.momId) : undefined;
    const history = state.statusHistories
      .filter(h => h.liquidation_id === l.id)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return { ...l, requestor, cashAdvance, mom, lineItems: items, history };
  });
  res.json(enriched);
});

// 9. Get single liquidation
liquidationsRouter.get('/liquidations/:id', (req, res) => {
  const user = getUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const l = state.liquidations.find(liq => liq.id === req.params.id);
  if (!l) return res.status(404).json({ error: 'Liquidation not found' });

  if (!canAccessLiquidation(user, l)) return res.status(403).json({ error: 'Forbidden' });

  const requestor = state.users.find(u => u.id === l.requestorId);
  const cashAdvance = state.cashAdvances.find(c => c.id === l.cashAdvanceId);
  const items = state.liquidationLineItems.filter(item => item.liquidationId === l.id);
  const mom = cashAdvance?.momId ? state.moms.find(m => m.id === cashAdvance.momId) : undefined;

  const history = state.statusHistories
    .filter(h => h.liquidation_id === l.id)
    .map(h => ({
      ...h,
      changedBy: state.users.find(u => u.id === h.changed_by)
    }))
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  res.json({ ...l, requestor, cashAdvance, mom, lineItems: items, history });
});

// 10. Initiate liquidation for a Released Cash Advance
liquidationsRouter.post('/liquidations', async (req, res) => {
  const user = getUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  if (!isClaimTypeEnabled('Liquidation')) return res.status(403).json({ error: COMING_SOON_MESSAGE });

  const { cashAdvanceId } = req.body;
  if (!cashAdvanceId) return res.status(400).json({ error: 'Cash Advance ID is required.' });

  const ca = state.cashAdvances.find(c => c.id === cashAdvanceId);
  if (!ca) return res.status(404).json({ error: 'Cash Advance not found' });

  if (ca.requestorId !== user.id) {
    return res.status(403).json({ error: 'You can only liquidate your own Cash Advances.' });
  }

  if (ca.status !== CashAdvanceStatus.RELEASED) {
    return res.status(400).json({ error: 'You can only liquidate Cash Advances that have been Released.' });
  }

  const existing = state.liquidations.find(l => l.cashAdvanceId === cashAdvanceId);
  if (existing) {
    return res.status(400).json({ error: 'A Liquidation already exists for this Cash Advance.' });
  }

  const liquidationId = uuidv4();
  const liquidation: Liquidation = {
    id: liquidationId,
    cashAdvanceId,
    requestorId: user.id,
    totalSpent: 0,
    varianceAmount: -ca.amount,
    varianceType: LiquidationVarianceType.REFUND_DUE,
    status: LiquidationStatus.DRAFT,
    createdAt: new Date().toISOString()
  };

  state.liquidations.push(liquidation);
  try {
    await persistLiquidation(liquidation);
  } catch (err) {
    console.error('[db] Could not persist new liquidation to Postgres:', err);
  }
  addLiqHistory(liquidationId, '', LiquidationStatus.DRAFT, user.id, 'Liquidation Draft Started');
  addCaHistory(ca.id, ca.status, ca.status, user.id, 'Liquidation Started');
  res.json(liquidation);
});

// 11. Add a line item to a Liquidation (editable only in Draft or ReturnedForRevision)
liquidationsRouter.post('/liquidations/:id/line-items', async (req, res) => {
  const user = getUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const l = state.liquidations.find(liq => liq.id === req.params.id);
  if (!l) return res.status(404).json({ error: 'Liquidation not found' });

  if (l.requestorId !== user.id) {
    return res.status(403).json({ error: 'You do not have permission to modify this Liquidation.' });
  }

  if (l.status !== LiquidationStatus.DRAFT && l.status !== LiquidationStatus.RETURNED_FOR_REVISION) {
    return res.status(400).json({ error: 'This Liquidation is read-only because it has been submitted.' });
  }

  const { expense_date, vendor, category, amount, payment_method, business_purpose, receipt_url, attachment_type, or_number } = req.body;
  if (!expense_date || !vendor || !category || amount === undefined || !payment_method || !business_purpose || !receipt_url) {
    return res.status(400).json({ error: 'Missing required expense fields.' });
  }

  const numericAmount = Number(amount);
  if (isNaN(numericAmount) || numericAmount <= 0) {
    return res.status(400).json({ error: 'Amount must be a valid number greater than zero.' });
  }

  const itemId = uuidv4();
  const newItem: LiquidationLineItem = {
    id: itemId,
    liquidationId: l.id,
    expense_date,
    vendor,
    category: normalizeExpenseCategory(category),
    amount: numericAmount,
    payment_method,
    business_purpose,
    receipt_url,
    attachment_type: attachment_type || 'Official Receipt',
    or_number: or_number || undefined
  };

  state.liquidationLineItems.push(newItem);
  await recalculateLiquidation(l.id);

  res.json(newItem);
});

// 12. Update a line item in a Liquidation
liquidationsRouter.put('/liquidations/:id/line-items/:itemId', async (req, res) => {
  const user = getUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const l = state.liquidations.find(liq => liq.id === req.params.id);
  if (!l) return res.status(404).json({ error: 'Liquidation not found' });

  if (l.requestorId !== user.id) {
    return res.status(403).json({ error: 'You do not have permission to modify this Liquidation.' });
  }

  if (l.status !== LiquidationStatus.DRAFT && l.status !== LiquidationStatus.RETURNED_FOR_REVISION) {
    return res.status(400).json({ error: 'This Liquidation is read-only because it has been submitted.' });
  }

  const item = state.liquidationLineItems.find(i => i.id === req.params.itemId && i.liquidationId === l.id);
  if (!item) return res.status(404).json({ error: 'Line item not found' });

  const { expense_date, vendor, category, amount, payment_method, business_purpose, receipt_url, attachment_type, or_number } = req.body;

  if (expense_date !== undefined) item.expense_date = expense_date;
  if (vendor !== undefined) item.vendor = vendor;
  if (category !== undefined) item.category = normalizeExpenseCategory(category);
  if (amount !== undefined) {
    const numericAmount = Number(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      return res.status(400).json({ error: 'Amount must be a valid number greater than zero.' });
    }
    item.amount = numericAmount;
  }
  if (payment_method !== undefined) item.payment_method = payment_method;
  if (business_purpose !== undefined) item.business_purpose = business_purpose;
  if (receipt_url !== undefined) item.receipt_url = receipt_url;
  if (attachment_type !== undefined) item.attachment_type = attachment_type;
  if (or_number !== undefined) item.or_number = or_number;

  await recalculateLiquidation(l.id);
  res.json(item);
});

// 13. Delete a line item from a Liquidation
liquidationsRouter.delete('/liquidations/:id/line-items/:itemId', async (req, res) => {
  const user = getUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const l = state.liquidations.find(liq => liq.id === req.params.id);
  if (!l) return res.status(404).json({ error: 'Liquidation not found' });

  if (l.requestorId !== user.id) {
    return res.status(403).json({ error: 'You do not have permission to modify this Liquidation.' });
  }

  if (l.status !== LiquidationStatus.DRAFT && l.status !== LiquidationStatus.RETURNED_FOR_REVISION) {
    return res.status(400).json({ error: 'This Liquidation is read-only because it has been submitted.' });
  }

  const index = state.liquidationLineItems.findIndex(i => i.id === req.params.itemId && i.liquidationId === l.id);
  if (index === -1) return res.status(404).json({ error: 'Line item not found' });

  state.liquidationLineItems.splice(index, 1);
  await recalculateLiquidation(l.id);

  res.json({ success: true });
});

// 14. Submit a Liquidation report
liquidationsRouter.post('/liquidations/:id/submit', async (req, res) => {
  const user = getUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const l = state.liquidations.find(liq => liq.id === req.params.id && liq.requestorId === user.id);
  if (!l) return res.status(404).json({ error: 'Liquidation not found' });

  if (l.status !== LiquidationStatus.DRAFT && l.status !== LiquidationStatus.RETURNED_FOR_REVISION) {
    return res.status(400).json({ error: 'Only Liquidations in Draft or ReturnedForRevision status can be submitted.' });
  }

  const liqPolicyError = checkCategoryLimits(state.liquidationLineItems.filter(i => i.liquidationId === l.id));
  if (liqPolicyError) return res.status(400).json({ error: liqPolicyError });

  await recalculateLiquidation(l.id);

  const { refundMethod } = req.body || {};
  if (refundMethod && l.varianceType === LiquidationVarianceType.REFUND_DUE) {
    l.refundMethod = refundMethod;
  }

  const oldStatus = l.status;
  l.status = LiquidationStatus.SUBMITTED;
  addLiqHistory(l.id, oldStatus, LiquidationStatus.SUBMITTED, user.id, 'Liquidation Submitted for Review');

  const ca = state.cashAdvances.find(c => c.id === l.cashAdvanceId);
  if (ca) {
    addCaHistory(ca.id, ca.status, ca.status, user.id, 'Liquidation Submitted');
    sendEmail(
      ca.approverId,
      `Liquidation Submitted - LIQ-${l.id.substring(0,6)}`,
      `A Liquidation report has been submitted by ${user.name} for Cash Advance CADV-${ca.id.substring(0,6)}.\n\nTotal Spent: PHP ${l.totalSpent}\nVariance: PHP ${l.varianceAmount} (${l.varianceType})`
    );
  }

  try {
    await persistLiquidation(l);
  } catch (err) {
    console.error('[db] Could not persist liquidation submission to Postgres:', err);
  }
  res.json(l);
});

// 15. Approve/Reviewed or Return a Liquidation report (Approver only)
liquidationsRouter.post('/liquidations/:id/review', async (req, res) => {
  const user = getUser(req);
  if (!user || user.role !== UserRole.APPROVER) return res.status(403).json({ error: 'Forbidden' });

  const l = state.liquidations.find(liq => liq.id === req.params.id);
  if (!l) return res.status(404).json({ error: 'Liquidation not found' });

  const ca = state.cashAdvances.find(c => c.id === l.cashAdvanceId);
  if (!ca || (ca.approverId !== user.id && !isActiveDelegateFor(user.id, ca.approverId))) {
    return res.status(403).json({ error: 'You are not the designated approver/reviewer for this Liquidation.' });
  }

  if (l.status !== LiquidationStatus.SUBMITTED) {
    return res.status(400).json({ error: 'Only Submitted Liquidations can be reviewed.' });
  }

  const { decision, comment } = req.body;
  if (!['Approved', 'Returned'].includes(decision)) {
    return res.status(400).json({ error: 'Invalid decision. Must be Approved or Returned.' });
  }

  if (decision === 'Returned' && !comment) {
    return res.status(400).json({ error: 'A comment is required when returning a Liquidation for revision.' });
  }

  let shortFallClaim: Claim | undefined;

  if (decision === 'Returned') {
    const oldStatus = l.status;
    l.status = LiquidationStatus.RETURNED_FOR_REVISION;
    addLiqHistory(l.id, oldStatus, LiquidationStatus.RETURNED_FOR_REVISION, user.id, comment || 'Returned for revision');
    addCaHistory(ca.id, ca.status, ca.status, user.id, `Liquidation Returned for Revision: ${comment}`);
    sendEmail(
      l.requestorId,
      `Liquidation Returned - LIQ-${l.id.substring(0,6)}`,
      `Your Liquidation report has been returned for revision by ${user.name}.\n\nReason: ${comment}`
    );
  } else {
    await recalculateLiquidation(l.id);

    if (l.varianceType === LiquidationVarianceType.SETTLED) {
      const oldStatus = l.status;
      const oldCaStatus = ca.status;
      l.status = LiquidationStatus.CLOSED;
      ca.status = CashAdvanceStatus.LIQUIDATED;
      addLiqHistory(l.id, oldStatus, LiquidationStatus.CLOSED, user.id, 'Liquidation Approved & Closed (Settled with zero variance)');
      addCaHistory(ca.id, oldCaStatus, CashAdvanceStatus.LIQUIDATED, user.id, 'Liquidation Closed');

      sendEmail(
        l.requestorId,
        `Liquidation Approved & Closed - LIQ-${l.id.substring(0,6)}`,
        `Your Liquidation report has been approved and closed by ${user.name}. Since it is settled with zero variance, no further action is required.`
      );
    } else if (l.varianceType === LiquidationVarianceType.REIMBURSEMENT_DUE) {
      const oldStatus = l.status;
      const oldCaStatus = ca.status;
      l.status = LiquidationStatus.CLOSED;
      ca.status = CashAdvanceStatus.LIQUIDATED;

      const claimId = uuidv4();
      const claimNumber = await generateClaimNumber();

      shortFallClaim = {
        id: claimId,
        claim_number: claimNumber,
        requestor_id: l.requestorId,
        current_approver_id: ca.approverId,
        mom_id: ca.momId || '',
        status: ClaimStatus.PROCESSING,
        total_amount: l.varianceAmount,
        approved_amount: Math.min(l.varianceAmount, REIMBURSEMENT_CAP),
        approved_at: new Date().toISOString(),
        expense_category: 'Cash Advance Shortfall',
        receipt_url: state.liquidationLineItems.find(item => item.liquidationId === l.id)?.receipt_url || '',
        remarks: `Automatic shortfall reimbursement from Liquidation of CADV-${ca.id.substring(0,6)}`,
        sourceLiquidationId: l.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        flagged_high_value: l.varianceAmount > state.systemSettings.highValueThreshold
      };

      state.claims.push(shortFallClaim);

      state.expenses.push({
        id: uuidv4(),
        claim_id: claimId,
        expense_date: new Date().toISOString().split('T')[0],
        vendor: 'Shortfall Payout',
        category: 'Cash Advance Shortfall',
        amount: l.varianceAmount,
        payment_method: 'Cash',
        business_purpose: `Shortfall payout for CADV-${ca.id.substring(0,6)} liquidation`,
        receipt_url: shortFallClaim.receipt_url
      });

      try {
        await persistClaimWithLineItems(shortFallClaim, state.expenses.filter(e => e.claim_id === claimId));
      } catch (err) {
        console.error('[db] Could not persist shortfall claim to Postgres:', err);
      }

      addHistory(claimId, ClaimStatus.DRAFT, ClaimStatus.PROCESSING, user.id, 'Automatic creation from Cash Advance Liquidation Shortfall');
      addLiqHistory(l.id, oldStatus, LiquidationStatus.CLOSED, user.id, `Liquidation Approved & Closed. Shortfall reimbursement claim created: ${claimNumber}`);
      addCaHistory(ca.id, oldCaStatus, CashAdvanceStatus.LIQUIDATED, user.id, 'Liquidation Closed (Reimbursement Payout Queued)');

      sendEmail(
        l.requestorId,
        `Liquidation Approved & Reimbursement Payout Queued - LIQ-${l.id.substring(0,6)}`,
        `Your Liquidation has been approved. A shortfall reimbursement claim ${claimNumber} for PHP ${l.varianceAmount} has been automatically created and routed directly to the Custodian's disbursement preparation queue.`
      );
    } else {
      const oldStatus = l.status;
      l.status = LiquidationStatus.REVIEWED;
      addLiqHistory(l.id, oldStatus, LiquidationStatus.REVIEWED, user.id, `Liquidation Approved & Reviewed. Pending refund of PHP ${Math.abs(l.varianceAmount)}`);
      addCaHistory(ca.id, ca.status, ca.status, user.id, 'Liquidation Reviewed (Pending Refund)');

      sendEmail(
        l.requestorId,
        `Liquidation Reviewed & Approved - LIQ-${l.id.substring(0,6)}`,
        `Your Liquidation has been approved and is awaiting Custodian refund collection of PHP ${Math.abs(l.varianceAmount)}.`
      );
    }
  }

  try {
    await persistLiquidation(l);
    await persistCashAdvance(ca);
    if (shortFallClaim) {
      await persistClaim(shortFallClaim);
      await persistExpenseLineItems(shortFallClaim.id, state.expenses.filter(e => e.claim_id === shortFallClaim!.id));
    }
  } catch (err) {
    console.error('[db] Could not persist liquidation review to Postgres:', err);
  }
  res.json(l);
});

// 16. Collect refund and close Liquidation (Custodian only)
liquidationsRouter.post('/liquidations/:id/collect-refund', async (req, res) => {
  const user = getUser(req);
  if (!user || user.role !== UserRole.CUSTODIAN) return res.status(403).json({ error: 'Forbidden: Only Custodians can collect refunds.' });

  const l = state.liquidations.find(liq => liq.id === req.params.id);
  if (!l) return res.status(404).json({ error: 'Liquidation not found' });

  if (l.status !== LiquidationStatus.REVIEWED) {
    return res.status(400).json({ error: 'Only Reviewed Liquidations with pending refunds can be marked collected.' });
  }

  if (l.varianceType !== LiquidationVarianceType.REFUND_DUE) {
    return res.status(400).json({ error: 'No refund is due for this Liquidation.' });
  }

  const { referenceNote, refundMethod } = req.body;
  if (!refundMethod || !state.systemSettings.paymentMethods.includes(refundMethod)) {
    return res.status(400).json({ error: `Refund method must be one of: ${state.systemSettings.paymentMethods.join(', ')}` });
  }

  const oldStatus = l.status;
  l.status = LiquidationStatus.CLOSED;

  const ca = state.cashAdvances.find(c => c.id === l.cashAdvanceId);
  let oldCaStatus = '';
  if (ca) {
    oldCaStatus = ca.status;
    ca.status = CashAdvanceStatus.LIQUIDATED;
  }

  addLiqHistory(l.id, oldStatus, LiquidationStatus.CLOSED, user.id, `Closed (Refund Collected via ${refundMethod}). Note: ${referenceNote || 'Collected by Custodian'}`);
  if (ca) {
    addCaHistory(ca.id, oldCaStatus, CashAdvanceStatus.LIQUIDATED, user.id, 'Closed (Refund Collected)');
  }

  (l as any).refundReference = referenceNote || 'Collected by Custodian';
  (l as any).refundMethod = refundMethod;
  (l as any).refundCollectedAt = new Date().toISOString();

  sendEmail(
    l.requestorId,
    `Liquidation Closed (Refund Collected) - LIQ-${l.id.substring(0,6)}`,
    `Your Liquidation has been marked as Closed. Custodian ${user.name} has verified collection of your refund of PHP ${Math.abs(l.varianceAmount)}.${referenceNote ? `\n\nReference: ${referenceNote}` : ''}`
  );

  try {
    await persistLiquidation(l);
    if (ca) await persistCashAdvance(ca);
  } catch (err) {
    console.error('[db] Could not persist refund collection to Postgres:', err);
  }
  res.json(l);
});
