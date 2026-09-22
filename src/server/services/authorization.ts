import { User, UserRole, Claim, Mom, Liquidation, ClaimStatus, DelegationStatus } from '../../lib/db/serverTypes';
import { state } from '../state';
import { isFinanceVisibleFinancialRecord } from '../constants';

export function isActiveDelegateFor(delegateId: string, approverId: string | undefined | null): boolean {
  return !!approverId && state.delegations.some(d =>
    d.delegate_id === delegateId && d.approver_id === approverId && d.status === DelegationStatus.ACTIVE
  );
}

export function canAccessClaim(user: User, claim: Claim): boolean {
  if (user.role === UserRole.ADMIN) return true;
  if (user.role === UserRole.FINANCE) return isFinanceVisibleFinancialRecord(claim.claim_type || 'Reimbursement', claim.status);
  if (user.role === UserRole.REQUESTOR) return claim.requestor_id === user.id;
  if (user.role === UserRole.APPROVER) {
    return claim.current_approver_id === user.id || claim.original_approver_id === user.id ||
      claim.requestor_id === user.id || isActiveDelegateFor(user.id, claim.current_approver_id);
  }
  if (user.role === UserRole.CUSTODIAN) {
    return [ClaimStatus.APPROVED, ClaimStatus.PROCESSING, ClaimStatus.READY_FOR_CLAIM, ClaimStatus.COMPLETED].includes(claim.status)
      || claim.requestor_id === user.id;
  }
  return false;
}

export function canAccessMom(user: User, mom: Mom): boolean {
  if (user.role === UserRole.CUSTODIAN) return false;
  if (user.role === UserRole.ADMIN) return true;
  if (user.role === UserRole.FINANCE) {
    const linkedClaim = state.claims.find(c => c.id === mom.claim_id);
    return Boolean(linkedClaim && isFinanceVisibleFinancialRecord(linkedClaim.claim_type || 'Reimbursement', linkedClaim.status));
  }
  if (user.role === UserRole.REQUESTOR) return mom.requestor_id === user.id;
  if (user.role === UserRole.APPROVER) {
    const reporteeIds = state.users.filter(u => u.reports_to === user.id).map(u => u.id);
    return mom.requestor_id === user.id || !!(mom.claim_id && mom.requestor_id && reporteeIds.includes(mom.requestor_id));
  }
  return false;
}

export function canAccessLiquidation(user: User, l: Liquidation): boolean {
  if (user.role === UserRole.REQUESTOR) return l.requestorId === user.id;
  if (user.role === UserRole.APPROVER) {
    const reporteeIds = state.users.filter(u => u.reports_to === user.id).map(u => u.id);
    const relatedCa = state.cashAdvances.find(c => c.id === l.cashAdvanceId);
    return l.requestorId === user.id || relatedCa?.approverId === user.id ||
      reporteeIds.includes(l.requestorId) || isActiveDelegateFor(user.id, relatedCa?.approverId);
  }
  if (user.role === UserRole.FINANCE) return isFinanceVisibleFinancialRecord('Liquidation', l.status);
  return true; // Custodian and Admin see all
}

export function findUploadAccessCheck(uploadUrlPath: string): ((user: User) => boolean) | null {
  const claim = state.claims.find(c => c.receipt_url === uploadUrlPath);
  if (claim) return (user) => canAccessClaim(user, claim);

  const expense = state.expenses.find(e => e.receipt_url === uploadUrlPath);
  if (expense) {
    const parentClaim = state.claims.find(c => c.id === expense.claim_id);
    if (parentClaim) return (user) => canAccessClaim(user, parentClaim);
  }

  const mom = state.moms.find(m => m.file_url === uploadUrlPath);
  if (mom) return (user) => canAccessMom(user, mom);

  const liqItem = state.liquidationLineItems.find(li => li.receipt_url === uploadUrlPath);
  if (liqItem) {
    const parentLiquidation = state.liquidations.find(l => l.id === liqItem.liquidationId);
    if (parentLiquidation) return (user) => canAccessLiquidation(user, parentLiquidation);
  }

  return null;
}
