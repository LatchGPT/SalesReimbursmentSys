import { DelegationStatus, ApproverDelegation } from '../../serverTypes';
import { state } from '../state';
import { addDelegationHistory } from './history';
import { persistDelegation } from '../../db/workflowExtrasRepo';

export function syncDelegationStatuses() {
  const now = new Date();
  state.delegations.forEach(d => {
    if (d.status === DelegationStatus.ACTIVE) {
      const end = new Date(d.end_date);
      end.setHours(23, 59, 59, 999);
      if (now > end) {
        const oldStatus = d.status;
        d.status = DelegationStatus.EXPIRED;
        d.updated_at = now.toISOString();
        addDelegationHistory(d.id, oldStatus, DelegationStatus.EXPIRED, 'system', 'Delegation window ended.');
        persistDelegation(d).catch((err: unknown) =>
          console.error('[db] Could not persist delegation expiry to Postgres:', err));
      }
    }
  });
}

export function getActiveDelegation(approverId: string, atDate: Date = new Date()): ApproverDelegation | undefined {
  syncDelegationStatuses();
  return state.delegations.find(d => {
    if (d.approver_id !== approverId || d.status !== DelegationStatus.ACTIVE) return false;
    const start = new Date(d.start_date);
    const end = new Date(d.end_date);
    end.setHours(23, 59, 59, 999);
    return atDate >= start && atDate <= end;
  });
}export function isActiveDelegateFor(delegateId: string, approverId: string | undefined | null): boolean {
  return !!approverId && state.delegations.some(d =>
    d.delegate_id === delegateId && d.approver_id === approverId && d.status === DelegationStatus.ACTIVE
  );
}
