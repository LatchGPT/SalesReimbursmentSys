import { Router } from 'express';
import { UserRole } from '../../serverTypes';
import { state } from '../state';
import { getUser } from '../middleware/auth';
import { isFinanceVisibleFinancialRecord } from '../constants';

export const expensesRouter = Router();

expensesRouter.get('/receipts', (req, res) => {
  const user = getUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  if (user.role !== UserRole.ADMIN && user.role !== UserRole.FINANCE) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const flatReceipts = [];

  // 1. Flatten claim expenses
  for (const exp of state.expenses) {
    const claim = state.claims.find(c => c.id === exp.claim_id);
    if (user.role === UserRole.FINANCE && (!claim || !isFinanceVisibleFinancialRecord(claim.claim_type || 'Reimbursement', claim.status))) continue;
    const reqUser = claim ? state.users.find(u => u.id === claim.requestor_id) : undefined;
    const claimNo = claim ? (claim.claim_number || `REIM-${claim.id.substring(0, 6)}`) : 'Unknown';

    flatReceipts.push({
      id: `exp-${exp.id}`,
      sourceId: exp.id,
      parentId: claim?.id || '',
      parentType: 'Claim',
      parentNumber: claimNo,
      receipt_url: exp.receipt_url || '',
      or_number: exp.or_number || '',
      vendor: exp.vendor || 'Unknown Vendor',
      amount: exp.amount,
      expense_date: exp.expense_date,
      category: exp.category,
      business_purpose: exp.business_purpose || '',
      requestor_name: reqUser ? reqUser.name : 'Unknown',
      requestor_department: reqUser ? reqUser.department : 'Unknown',
    });
  }

  // 2. Flatten liquidation expenses
  for (const item of state.liquidationLineItems) {
    const liq = state.liquidations.find(l => l.id === item.liquidationId);
    if (user.role === UserRole.FINANCE && (!liq || !isFinanceVisibleFinancialRecord('Liquidation', liq.status))) continue;
    const reqUser = liq ? state.users.find(u => u.id === liq.requestorId) : undefined;
    const liqNo = liq ? `LIQ-${liq.id.substring(0, 6)}` : 'Unknown';

    flatReceipts.push({
      id: `liq-${item.id}`,
      sourceId: item.id,
      parentId: liq?.id || '',
      parentType: 'Liquidation',
      parentNumber: liqNo,
      receipt_url: item.receipt_url || '',
      or_number: item.or_number || '',
      vendor: item.vendor || 'Unknown Vendor',
      amount: item.amount,
      expense_date: item.expense_date,
      category: item.category,
      business_purpose: item.business_purpose || '',
      requestor_name: reqUser ? reqUser.name : 'Unknown',
      requestor_department: reqUser ? reqUser.department : 'Unknown',
    });
  }

  // Sort by expense date descending
  flatReceipts.sort((a, b) => new Date(b.expense_date).getTime() - new Date(a.expense_date).getTime());

  res.json(flatReceipts);
});
