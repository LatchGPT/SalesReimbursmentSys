import { CashAdvance, CashAdvanceStatus, MomStatus, User, UserRole } from '../../lib/db/serverTypes';
import { v4 as uuidv4 } from 'uuid';
import { state } from '../../server/state';
import { isActiveDelegateFor } from '../../server/services/delegations';
import { isFinanceVisibleFinancialRecord } from '../../server/constants';
import { isClaimTypeEnabled, COMING_SOON_MESSAGE } from '../featureFlags';
import { persistCashAdvance } from '../../lib/db/cashAdvanceRepo';
import { addCaHistory } from '../../server/services/history';
import { getActiveDelegation } from '../../server/services/delegations';
import { sendEmail } from '../../server/services/notifications';

type ErrorBody = { error: string };
type Result<T> = { status: number; body: T };

function userFor(id: string | null): User | undefined {
  return state.users.find((user) => user.id === id || user.entra_object_id === id || user.user_principal_name === id);
}

function canAccess(user: User, advance: CashAdvance): boolean {
  if (user.role === UserRole.REQUESTOR) return advance.requestorId === user.id;
  if (user.role === UserRole.APPROVER) return advance.approverId === user.id || advance.requestorId === user.id || state.users.some((candidate) => candidate.id === advance.requestorId && candidate.reports_to === user.id) || isActiveDelegateFor(user.id, advance.approverId);
  if (user.role === UserRole.FINANCE) return isFinanceVisibleFinancialRecord('Cash Advance', advance.status);
  return true;
}

function enrich(advance: CashAdvance, includeChangedBy = false) {
  const history = state.statusHistories.filter((entry) => entry.cash_advance_id === advance.id).map((entry) => includeChangedBy ? { ...entry, changedBy: state.users.find((user) => user.id === entry.changed_by) } : entry).sort((left, right) => new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime());
  return { ...advance, requestor: state.users.find((user) => user.id === advance.requestorId), approver: state.users.find((user) => user.id === advance.approverId), mom: advance.momId ? state.moms.find((mom) => mom.id === advance.momId) : undefined, history };
}

export function listCashAdvances(userId: string | null): Result<Array<ReturnType<typeof enrich>> | ErrorBody> {
  const user = userFor(userId);
  if (!user) return { status: 401, body: { error: 'Unauthorized' } };
  return { status: 200, body: state.cashAdvances.filter((advance) => canAccess(user, advance)).map((advance) => enrich(advance)) };
}

export function getCashAdvance(userId: string | null, id: string): Result<ReturnType<typeof enrich> | ErrorBody> {
  const user = userFor(userId);
  if (!user) return { status: 401, body: { error: 'Unauthorized' } };
  const advance = state.cashAdvances.find((candidate) => candidate.id === id);
  if (!advance) return { status: 404, body: { error: 'Cash Advance not found' } };
  if (!canAccess(user, advance)) return { status: 403, body: { error: 'Forbidden' } };
  return { status: 200, body: enrich(advance, true) };
}

export async function createCashAdvance(userId: string | null, input: { amount?: unknown; purpose?: string; momId?: string }): Promise<Result<CashAdvance | ErrorBody>> {
  const user = userFor(userId);
  if (!user) return { status: 401, body: { error: 'Unauthorized' } };
  if (user.role === UserRole.FINANCE) return { status: 403, body: { error: 'Finance access is view-only.' } };
  if (!isClaimTypeEnabled('Cash Advance')) return { status: 403, body: { error: COMING_SOON_MESSAGE } };
  if (!user.reports_to) return { status: 403, body: { error: 'Forbidden: You must have a designated manager (reports_to) to submit.' } };
  if (state.cashAdvances.some((advance) => advance.requestorId === user.id && advance.status !== CashAdvanceStatus.LIQUIDATED && advance.status !== CashAdvanceStatus.REJECTED)) return { status: 400, body: { error: 'A requestor may only have one active (unliquidated) Cash Advance at a time. Please liquidate or resolve your current open Cash Advance before requesting a new one.' } };
  if (input.amount === undefined || input.amount === null || input.amount === '') return { status: 400, body: { error: 'Amount is required.' } };
  const amount = Number(input.amount);
  if (!Number.isFinite(amount) || amount <= 0) return { status: 400, body: { error: 'Amount must be a valid positive number.' } };
  if (!input.purpose) return { status: 400, body: { error: 'Purpose is required.' } };
  if (input.momId) { const mom = state.moms.find((candidate) => candidate.id === input.momId); if (!mom) return { status: 400, body: { error: 'Minutes of Meeting (MOM) not found.' } }; if (mom.status !== MomStatus.COMPLETED) return { status: 400, body: { error: 'Cannot attach an incomplete or draft Minutes of Meeting.' } }; }
  const advance: CashAdvance = { id: uuidv4(), requestorId: user.id, amount, purpose: input.purpose, momId: input.momId, approverId: user.reports_to, status: CashAdvanceStatus.DRAFT, createdAt: new Date().toISOString() };
  state.cashAdvances.push(advance);
  try { await persistCashAdvance(advance); } catch (error) { console.error('[db] Could not persist new cash advance to Postgres:', error); }
  addCaHistory(advance.id, '', CashAdvanceStatus.DRAFT, user.id, 'Cash Advance Draft Created');
  return { status: 200, body: advance };
}

export async function submitCashAdvance(userId: string | null, id: string): Promise<Result<CashAdvance | ErrorBody>> {
  const user = userFor(userId);
  if (!user) return { status: 401, body: { error: 'Unauthorized' } };
  if (user.role === UserRole.FINANCE) return { status: 403, body: { error: 'Finance access is view-only.' } };
  const advance = state.cashAdvances.find((candidate) => candidate.id === id && candidate.requestorId === user.id);
  if (!advance) return { status: 404, body: { error: 'Cash Advance not found' } };
  if (![CashAdvanceStatus.DRAFT, CashAdvanceStatus.REJECTED].includes(advance.status)) return { status: 400, body: { error: 'Only Cash Advances in Draft or Rejected status can be submitted.' } };
  const oldStatus = advance.status;
  advance.status = CashAdvanceStatus.SUBMITTED;
  if (user.reports_to) advance.approverId = getActiveDelegation(user.reports_to)?.delegate_id || user.reports_to;
  addCaHistory(advance.id, oldStatus, CashAdvanceStatus.SUBMITTED, user.id, 'Cash Advance Submitted for Approval');
  const approver = state.users.find((candidate) => candidate.id === advance.approverId);
  if (approver) sendEmail(approver.id, `Cash Advance Request Submitted - CADV-${advance.id.substring(0, 6)}`, `A Cash Advance request for PHP ${advance.amount} has been submitted by ${user.name} for your approval.\n\nPurpose: ${advance.purpose}`);
  sendEmail(user.id, `Cash Advance Request Submitted - CADV-${advance.id.substring(0, 6)}`, `Your Cash Advance request for PHP ${advance.amount} has been successfully submitted${approver ? ` and routed to ${approver.name} for approval` : ''}.\n\nPurpose: ${advance.purpose}\n\nYou'll receive another email as soon as a decision is made.`);
  try { await persistCashAdvance(advance); } catch (error) { console.error('[db] Could not persist cash advance submission to Postgres:', error); }
  return { status: 200, body: advance };
}

export async function updateCashAdvance(userId: string | null, id: string, input: { amount?: unknown; purpose?: string; momId?: string | null }): Promise<Result<CashAdvance | ErrorBody>> {
  const user = userFor(userId); if (!user) return { status: 401, body: { error: 'Unauthorized' } }; if (user.role === UserRole.FINANCE) return { status: 403, body: { error: 'Finance access is view-only.' } };
  const advance = state.cashAdvances.find((candidate) => candidate.id === id); if (!advance) return { status: 404, body: { error: 'Cash Advance not found' } };
  if ([CashAdvanceStatus.RELEASED, CashAdvanceStatus.LIQUIDATED].includes(advance.status) && user.role !== UserRole.ADMIN) return { status: 403, body: { error: 'This Cash Advance has already been released/liquidated. Its amount, purpose, and MOM are locked and can only be modified by an Admin.' } };
  if (input.amount !== undefined) { const amount = Number(input.amount); if (!Number.isFinite(amount) || amount <= 0) return { status: 400, body: { error: 'Amount must be a valid positive number.' } }; advance.amount = amount; }
  if (input.purpose !== undefined) { if (!input.purpose) return { status: 400, body: { error: 'Purpose cannot be empty.' } }; advance.purpose = input.purpose; }
  if (input.momId !== undefined) { if (input.momId) { const mom = state.moms.find((candidate) => candidate.id === input.momId); if (!mom) return { status: 400, body: { error: 'Minutes of Meeting (MOM) not found.' } }; if (mom.status !== MomStatus.COMPLETED) return { status: 400, body: { error: 'Cannot attach an incomplete or draft Minutes of Meeting.' } }; } advance.momId = input.momId || undefined; }
  try { await persistCashAdvance(advance); } catch (error) { console.error('[db] Could not persist cash advance changes to Postgres:', error); }
  return { status: 200, body: advance };
}

export async function decideCashAdvance(userId: string | null, id: string, input: { decision?: string; comment?: string }): Promise<Result<CashAdvance | ErrorBody>> {
  const user = userFor(userId); if (!user || user.role !== UserRole.APPROVER) return { status: 403, body: { error: 'Forbidden' } };
  const advance = state.cashAdvances.find((candidate) => candidate.id === id); if (!advance) return { status: 404, body: { error: 'Cash Advance not found' } };
  if (advance.approverId !== user.id && !isActiveDelegateFor(user.id, advance.approverId)) return { status: 403, body: { error: 'You are not the designated approver for this Cash Advance.' } };
  if (advance.status !== CashAdvanceStatus.SUBMITTED) return { status: 400, body: { error: 'Only Submitted Cash Advances can be approved or rejected.' } };
  if (input.decision !== 'Approved' && input.decision !== 'Rejected') return { status: 400, body: { error: 'Invalid decision. Must be Approved or Rejected.' } };
  if (input.decision === 'Rejected' && !input.comment) return { status: 400, body: { error: 'A comment is required when rejecting a Cash Advance.' } };
  const oldStatus = advance.status; advance.status = input.decision === 'Approved' ? CashAdvanceStatus.APPROVED : CashAdvanceStatus.REJECTED; advance.approvedAt = input.decision === 'Approved' ? new Date().toISOString() : undefined; if (input.decision === 'Rejected') advance.paidAmount = undefined;
  addCaHistory(advance.id, oldStatus, advance.status, user.id, input.comment || `Cash Advance ${input.decision}`); sendEmail(advance.requestorId, `Cash Advance Request ${input.decision} - CADV-${advance.id.substring(0, 6)}`, `Your Cash Advance request for PHP ${advance.amount} has been ${input.decision} by ${user.name}.${input.comment ? `\n\nComment: ${input.comment}` : ''}`);
  try { await persistCashAdvance(advance); } catch (error) { console.error('[db] Could not persist cash advance decision to Postgres:', error); }
  return { status: 200, body: advance };
}

export async function releaseCashAdvance(userId: string | null, id: string, input: { releaseReference?: string; releaseMethod?: string }): Promise<Result<CashAdvance | ErrorBody>> {
  const user = userFor(userId); if (!user || user.role !== UserRole.CUSTODIAN) return { status: 403, body: { error: 'Forbidden: Only Custodians can release Cash Advances.' } };
  const advance = state.cashAdvances.find((candidate) => candidate.id === id); if (!advance) return { status: 404, body: { error: 'Cash Advance not found' } };
  if (advance.status !== CashAdvanceStatus.APPROVED) return { status: 400, body: { error: 'Only Approved Cash Advances can be released.' } };
  if (!input.releaseReference) return { status: 400, body: { error: 'Release Reference/Voucher is required.' } };
  if (!input.releaseMethod || !state.systemSettings.paymentMethods.includes(input.releaseMethod)) return { status: 400, body: { error: `Release method must be one of: ${state.systemSettings.paymentMethods.join(', ')}` } };
  const oldStatus = advance.status; advance.status = CashAdvanceStatus.RELEASED; advance.releasedBy = user.id; advance.releaseDate = new Date().toISOString(); advance.paidAmount = advance.amount; advance.releaseReference = input.releaseReference; advance.releaseMethod = input.releaseMethod;
  addCaHistory(advance.id, oldStatus, CashAdvanceStatus.RELEASED, user.id, `Released via ${input.releaseMethod} with Voucher Reference: ${input.releaseReference}`); sendEmail(advance.requestorId, `Cash Advance Released - CADV-${advance.id.substring(0, 6)}`, `Your Cash Advance for PHP ${advance.amount} has been released by ${user.name}.\n\nRelease Reference: ${input.releaseReference}\n\nPlease file your liquidation within 30 days.`);
  try { await persistCashAdvance(advance); } catch (error) { console.error('[db] Could not persist cash advance release to Postgres:', error); }
  return { status: 200, body: advance };
}
