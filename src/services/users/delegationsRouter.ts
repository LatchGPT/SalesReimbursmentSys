import { v4 as uuidv4 } from 'uuid';
import { type ApproverDelegation, DelegationStatus, UserRole } from '../../lib/db/serverTypes';
import { state } from '../../server/state';
import { syncDelegationStatuses } from '../../server/services/delegations';
import { addDelegationHistory } from '../../server/services/history';
import { sendEmail } from '../../server/services/notifications';
import { persistDelegation } from '../../lib/db/workflowExtrasRepo';

type ErrorBody = { error: string };
type Result<T> = { status: number; body: T };
type DelegationBody = { delegate_id?: string; start_date?: string; end_date?: string };
function userFor(id: string | null) { return state.users.find((user) => user.id === id || user.entra_object_id === id || user.user_principal_name === id); }
async function save(delegation: ApproverDelegation, message: string) { try { await persistDelegation(delegation); } catch (error) { console.error(`[db] Could not persist delegation ${message} to Postgres:`, error); } }

export function listDelegations(userId: string | null): Result<Array<ApproverDelegation & { approver: typeof state.users[number] | undefined; delegate: typeof state.users[number] | undefined }> | ErrorBody> {
  const user = userFor(userId); if (!user) return { status: 401, body: { error: 'Unauthorized' } };
  syncDelegationStatuses();
  const body = state.delegations.filter((delegation) => delegation.approver_id === user.id || delegation.delegate_id === user.id).map((delegation) => ({ ...delegation, approver: state.users.find((candidate) => candidate.id === delegation.approver_id), delegate: state.users.find((candidate) => candidate.id === delegation.delegate_id) })).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  return { status: 200, body };
}

export async function createDelegation(userId: string | null, body: DelegationBody): Promise<Result<ApproverDelegation | ErrorBody>> {
  const user = userFor(userId); if (!user || user.role !== UserRole.APPROVER) return { status: 403, body: { error: 'Forbidden' } };
  const { delegate_id, start_date, end_date } = body;
  if (!delegate_id || !start_date || !end_date) return { status: 400, body: { error: 'Delegate, start date, and end date are all required.' } };
  if (delegate_id === user.id) return { status: 400, body: { error: 'You cannot delegate to yourself.' } };
  const delegate = state.users.find((candidate) => candidate.id === delegate_id); if (!delegate || delegate.role !== UserRole.APPROVER) return { status: 400, body: { error: 'You can only delegate to another Approver.' } };
  if (new Date(start_date) > new Date(end_date)) return { status: 400, body: { error: 'The start date cannot be after the end date.' } };
  const now = new Date().toISOString(); const delegation: ApproverDelegation = { id: uuidv4(), approver_id: user.id, delegate_id, start_date, end_date, status: DelegationStatus.PENDING, created_by: user.id, created_at: now, updated_at: now };
  state.delegations.push(delegation); await save(delegation, 'creation'); addDelegationHistory(delegation.id, '', DelegationStatus.PENDING, user.id, `Delegation requested to ${delegate.name}`);
  sendEmail(delegate_id, `Delegation Request from ${user.name}`, `${user.name} has asked you to cover their approval duties from ${start_date} to ${end_date}.\n\nPlease log in and Accept or Decline this request from Settings > Approval Delegation. Your decision does not take effect until you respond - claims will keep routing to ${user.name} until then.`, undefined, { eventKey: 'delegation' });
  return { status: 200, body: delegation };
}

export async function acceptDelegation(userId: string | null, id: string): Promise<Result<ApproverDelegation | ErrorBody>> {
  const user = userFor(userId); if (!user) return { status: 401, body: { error: 'Unauthorized' } }; syncDelegationStatuses();
  const delegation = state.delegations.find((candidate) => candidate.id === id); if (!delegation) return { status: 404, body: { error: 'Delegation not found' } }; if (delegation.delegate_id !== user.id) return { status: 403, body: { error: 'Forbidden' } }; if (delegation.status !== DelegationStatus.PENDING) return { status: 400, body: { error: `This request is ${delegation.status.toLowerCase()} and can no longer be accepted.` } };
  const oldStatus = delegation.status; delegation.status = DelegationStatus.ACTIVE; delegation.updated_at = new Date().toISOString(); addDelegationHistory(id, oldStatus, DelegationStatus.ACTIVE, user.id, 'Delegation accepted'); sendEmail(delegation.approver_id, `${user.name} accepted your delegation request`, `${user.name} has accepted your request to cover approvals from ${delegation.start_date} to ${delegation.end_date}. Claims from your direct reports will now route to them for that period.`, undefined, { eventKey: 'delegation' }); await save(delegation, 'acceptance'); return { status: 200, body: delegation };
}

export async function declineDelegation(userId: string | null, id: string, body: { reason?: string }): Promise<Result<ApproverDelegation | ErrorBody>> {
  const user = userFor(userId); if (!user) return { status: 401, body: { error: 'Unauthorized' } }; const delegation = state.delegations.find((candidate) => candidate.id === id); if (!delegation) return { status: 404, body: { error: 'Delegation not found' } }; if (delegation.delegate_id !== user.id) return { status: 403, body: { error: 'Forbidden' } }; if (delegation.status !== DelegationStatus.PENDING) return { status: 400, body: { error: `This request is ${delegation.status.toLowerCase()} and can no longer be declined.` } };
  const oldStatus = delegation.status; const reason = body.reason; delegation.status = DelegationStatus.DECLINED; delegation.decline_reason = reason || undefined; delegation.updated_at = new Date().toISOString(); addDelegationHistory(id, oldStatus, DelegationStatus.DECLINED, user.id, reason || 'Delegation declined'); sendEmail(delegation.approver_id, `${user.name} declined your delegation request`, `${user.name} has declined your request to cover approvals from ${delegation.start_date} to ${delegation.end_date}.${reason ? `\n\nReason: ${reason}` : ''}\n\nPlease choose a different delegate if you still need coverage for this period.`, undefined, { eventKey: 'delegation' }); await save(delegation, 'decline'); return { status: 200, body: delegation };
}

export async function cancelDelegation(userId: string | null, id: string): Promise<Result<ApproverDelegation | ErrorBody>> {
  const user = userFor(userId); if (!user) return { status: 401, body: { error: 'Unauthorized' } }; const delegation = state.delegations.find((candidate) => candidate.id === id); if (!delegation) return { status: 404, body: { error: 'Delegation not found' } }; if (delegation.approver_id !== user.id) return { status: 403, body: { error: 'Forbidden' } }; if (delegation.status !== DelegationStatus.PENDING && delegation.status !== DelegationStatus.ACTIVE) return { status: 400, body: { error: `This delegation is already ${delegation.status.toLowerCase()}.` } };
  const oldStatus = delegation.status; delegation.status = DelegationStatus.CANCELLED; delegation.updated_at = new Date().toISOString(); addDelegationHistory(id, oldStatus, DelegationStatus.CANCELLED, user.id, 'Delegation cancelled by approver'); sendEmail(delegation.delegate_id, `${user.name} cancelled their delegation request`, `${user.name} has cancelled the delegation ${oldStatus === DelegationStatus.ACTIVE ? 'that was active' : 'request'} covering ${delegation.start_date} to ${delegation.end_date}. ${oldStatus === DelegationStatus.ACTIVE ? 'You no longer need to act on their behalf.' : 'No action is needed.'}`, undefined, { eventKey: 'delegation' }); await save(delegation, 'cancellation'); return { status: 200, body: delegation };
}
