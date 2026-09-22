import { UserRole, ClaimStatus, Claim } from '../../lib/db/serverTypes';
import { state } from '../state';
import { STALE_APPROVER_FALLBACK_DAYS } from '../constants';
import { addHistory } from './history';
import { sendEmail } from './notifications';
import { persistClaim } from '../../lib/db/coreLoopRepo';

export function recalcApprovalAuthority(userId: string | null) {
  if (!userId) return;
  const u = state.users.find(x => x.id === userId);
  if (!u) return;
  u.can_approve_reimbursements = u.role === UserRole.APPROVER && state.users.some(x => x.reports_to === userId);
}

export async function detectStaleApprovers(
  requestorId: string,
  oldManagerId: string | null,
  newManagerId: string | null,
  changedBy: string
) {
  if (!oldManagerId || oldManagerId === newManagerId) return;
  const requestor = state.users.find(u => u.id === requestorId);
  const oldApprover = state.users.find(u => u.id === oldManagerId);
  const newApprover = newManagerId ? state.users.find(u => u.id === newManagerId) : undefined;

  const affected = state.claims.filter(c =>
    c.requestor_id === requestorId &&
    c.current_approver_id === oldManagerId &&
    c.status === ClaimStatus.PENDING_APPROVAL
  );

  for (const claim of affected) {
    claim.approver_stale_since = new Date().toISOString();
    claim.pending_transfer_to = newManagerId || null;
    claim.approver_stale_reason = `${requestor?.name || 'This requestor'} no longer reports to ${oldApprover?.name || 'you'}.`;
    claim.escalated_to_admin = false;

    addHistory(claim.id, claim.status, claim.status, changedBy,
      `Org change: ${requestor?.name || requestorId}'s manager changed from ${oldApprover?.name || '(none)'} to ${newApprover?.name || '(none)'}. Approver notified per hierarchy-sync policy.`);

    const claimNumber = claim.claim_number || `REIM-${claim.id.substring(0, 6)}`;
    sendEmail(oldManagerId,
      `Org change — approver review needed for ${claimNumber}`,
      `${requestor?.name || 'This requestor'} no longer reports to you. Their manager is now ${newApprover?.name || 'unassigned'}.

You can keep reviewing ${claimNumber} yourself, or transfer it to ${newApprover?.name || 'the new manager'} from your Approver Inbox.

If no action is taken within ${STALE_APPROVER_FALLBACK_DAYS} days, this will be escalated to an Admin for manual reassignment.`);

    try {
      await persistClaim(claim);
    } catch (err) {
      console.error('[db] Could not persist stale-approver flag to Postgres:', err);
    }
  }
}

export async function runStaleApproverFallbackCheck(force: boolean, changedBy: string): Promise<Claim[]> {
  const now = Date.now();
  const escalated: Claim[] = [];
  const admins = state.users.filter(u => u.role === UserRole.ADMIN);

  state.claims.forEach(claim => {
    if (!claim.approver_stale_since || claim.escalated_to_admin) return;
    const days = (now - new Date(claim.approver_stale_since).getTime()) / (1000 * 60 * 60 * 24);
    if (days >= STALE_APPROVER_FALLBACK_DAYS || force) {
      claim.escalated_to_admin = true;
      escalated.push(claim);

      const claimNumber = claim.claim_number || `REIM-${claim.id.substring(0, 6)}`;
      const currentApprover = state.users.find(u => u.id === claim.current_approver_id);
      const suggested = claim.pending_transfer_to ? state.users.find(u => u.id === claim.pending_transfer_to) : undefined;
      addHistory(claim.id, claim.status, claim.status, changedBy,
        `Fallback escalation: ${claimNumber} unresolved org-change notice sent to Admin.`);
      admins.forEach(admin => sendEmail(admin.id, `Escalation: stuck approval - ${claimNumber}`,
        `${claimNumber} has had an unresolved org-change approver notice for ${STALE_APPROVER_FALLBACK_DAYS}+ days.

Current approver: ${currentApprover?.name || '(unknown)'}
Suggested new approver: ${suggested?.name || '(unassigned)'}
Reason: ${claim.approver_stale_reason || 'Org change'}

Manual reassignment may be needed.`));
    }
  });

  try {
    for (const claim of escalated) await persistClaim(claim);
  } catch (err) {
    console.error('[db] Could not persist fallback escalation to Postgres:', err);
  }

  return escalated;
}
