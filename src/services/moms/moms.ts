import { v4 as uuidv4 } from 'uuid';
import { Mom, MomStatus, MinutesSource, UserRole } from '../../lib/db/serverTypes';
import { state } from '../../server/state';
import { canAccessMom } from '../../server/services/authorization';
import { isFinanceVisibleFinancialRecord } from '../../server/constants';
import { getOrCreateCompany } from '../../server/services/companyService';
import { getActiveDelegation } from '../../server/services/delegations';
import { validateRequiredCustomFields } from '../admin/fieldDefinitionsRouter';
import { sendEmail } from '../../server/services/notifications';
import { persistMom } from '../../lib/db/coreLoopRepo';

type ErrorBody = { error: string };
type Result<T> = { status: number; body: T };
type MomInput = Partial<Mom>;

function userFor(id: string | null) {
  return state.users.find((user) => user.id === id || user.entra_object_id === id || user.user_principal_name === id);
}

async function save(mom: Mom, action: string) {
  try { await persistMom(mom); }
  catch (error) { console.error(`[db] Could not persist MOM ${action} to Postgres:`, error); }
}

export function listMoms(userId: string | null): Result<Array<Mom & Record<string, unknown>> | ErrorBody> {
  const user = userFor(userId);
  if (!user) return { status: 401, body: { error: 'Unauthorized' } };
  const relevant = user.role === UserRole.ADMIN ? state.moms
    : user.role === UserRole.CUSTODIAN ? []
    : user.role === UserRole.FINANCE ? state.moms.filter((mom) => {
      const claim = state.claims.find((candidate) => candidate.id === mom.claim_id);
      return Boolean(claim && isFinanceVisibleFinancialRecord(claim.claim_type || 'Reimbursement', claim.status));
    })
    : user.role === UserRole.REQUESTOR ? state.moms.filter((mom) => mom.requestor_id === user.id)
    : state.moms.filter((mom) => mom.requestor_id === user.id || Boolean(mom.claim_id && mom.requestor_id && state.users.some((candidate) => candidate.id === mom.requestor_id && candidate.reports_to === user.id)));
  return { status: 200, body: relevant.map((mom) => {
    const requestor = state.users.find((candidate) => candidate.id === mom.requestor_id);
    return { ...mom, prepared_by: requestor?.name || mom.prepared_by || 'Unknown', prepared_by_department: requestor?.department, prepared_by_job_title: requestor?.job_title, client_name: mom.client || mom.summary || 'Unknown Client' };
  }) };
}

export function getMom(userId: string | null, id: string): Result<(Mom & Record<string, unknown>) | ErrorBody> {
  const user = userFor(userId);
  if (!user) return { status: 401, body: { error: 'Unauthorized' } };
  if (user.role === UserRole.CUSTODIAN) return { status: 403, body: { error: 'Forbidden' } };
  const mom = state.moms.find((candidate) => candidate.id === id);
  if (!mom) return { status: 404, body: { error: 'Minutes of Meeting not found' } };
  if (!canAccessMom(user, mom)) return { status: 403, body: { error: 'Forbidden' } };
  const requestor = state.users.find((candidate) => candidate.id === mom.requestor_id);
  return { status: 200, body: { ...mom, requestor, prepared_by: requestor?.name || mom.prepared_by || 'Unknown', prepared_by_department: requestor?.department, prepared_by_job_title: requestor?.job_title, linkedClaim: mom.claim_id ? state.claims.find((claim) => claim.id === mom.claim_id) : undefined } };
}

export async function createMom(userId: string | null, input: MomInput): Promise<Result<Mom | ErrorBody>> {
  const user = userFor(userId);
  if (user?.role === UserRole.FINANCE) return { status: 403, body: { error: 'Finance access is view-only.' } };
  if (!user || !user.reports_to) return { status: 403, body: { error: 'Forbidden: You must have a designated manager (reports_to) to submit.' } };
  const mom: Mom = { id: uuidv4(), requestor_id: user.id, document_type: input.document_type === 'LOA' ? 'LOA' : 'MoM', client: input.client || '', contact_person: input.contact_person || '', contact_person_email: input.contact_person_email || '', cc_client: Boolean(input.cc_client), meeting_date: input.meeting_date || new Date().toISOString().split('T')[0], meeting_time: input.meeting_time || '', location: input.location || '', purpose: input.purpose || '', discussion: input.discussion || '', agreements: input.agreements || '', action_items: input.action_items || '', prepared_by: user.name, prepared_by_department: user.department, prepared_by_job_title: user.job_title, file_url: input.file_url, file_name: input.file_name, status: input.status || MomStatus.DRAFT, created_at: new Date().toISOString(), minutes_source: input.minutes_source || MinutesSource.TEMPLATE, meeting_type: input.meeting_type || '', participants_internal: input.participants_internal || '', participants_external: input.participants_external || '', custom_fields: input.custom_fields || undefined };
  await getOrCreateCompany(mom.client, user.id);
  state.moms.push(mom);
  await save(mom, 'creation');
  return { status: 200, body: mom };
}

export async function updateMom(userId: string | null, id: string, input: MomInput): Promise<Result<Mom | ErrorBody>> {
  const user = userFor(userId);
  if (!user) return { status: 401, body: { error: 'Unauthorized' } };
  if (user.role === UserRole.FINANCE) return { status: 403, body: { error: 'Finance access is view-only.' } };
  const mom = state.moms.find((candidate) => candidate.id === id);
  if (!mom) return { status: 404, body: { error: 'MOM not found' } };
  if (user.role === UserRole.REQUESTOR && mom.requestor_id !== user.id) return { status: 403, body: { error: 'Forbidden' } };
  if (user.role === UserRole.APPROVER && mom.requestor_id !== user.id) {
    const owner = state.users.find((candidate) => candidate.id === mom.requestor_id);
    const authorized = Boolean(owner?.reports_to === user.id || (owner?.reports_to && getActiveDelegation(owner.reports_to)?.delegate_id === user.id));
    if (!authorized) return { status: 403, body: { error: 'Forbidden: not your direct report' } };
  }
  const keys: Array<keyof Mom> = ['client', 'contact_person', 'contact_person_email', 'cc_client', 'meeting_date', 'meeting_time', 'location', 'purpose', 'discussion', 'agreements', 'action_items', 'status', 'file_url', 'file_name', 'meeting_type', 'participants_internal', 'participants_external', 'custom_fields'];
  for (const key of keys) if (input[key] !== undefined) (mom[key] as never) = input[key] as never;
  await getOrCreateCompany(mom.client, user.id);
  await save(mom, 'update');
  return { status: 200, body: mom };
}

export async function sendMom(userId: string | null, id: string): Promise<Result<Mom | ErrorBody>> {
  const user = userFor(userId);
  if (!user) return { status: 401, body: { error: 'Unauthorized' } };
  if (user.role === UserRole.FINANCE) return { status: 403, body: { error: 'Finance access is view-only.' } };
  const mom = state.moms.find((candidate) => candidate.id === id && candidate.requestor_id === user.id);
  if (!mom) return { status: 404, body: { error: 'MOM not found' } };
  const error = validateRequiredCustomFields('mom', mom.custom_fields);
  if (error) return { status: 400, body: { error } };
  mom.status = MomStatus.COMPLETED;
  const subject = `Meeting Summary - ${mom.client || 'Client'}`;
  const body = `Thank you for meeting with us on ${mom.meeting_date} regarding ${mom.purpose || 'our business discussion'}.\n\nDiscussion:\n${mom.discussion || 'No discussion points added.'}\n\nAgreements:\n${mom.agreements || 'No agreements listed.'}\n\nAction Items:\n${mom.action_items || 'No action items listed.'}\n\nBest regards,\n${user.name}`;
  sendEmail(mom.contact_person_email || 'client@mgenesis.com', subject, body, user.reports_to || undefined, { plain: true, recipientName: mom.contact_person || 'Valued Client', fromLabel: `${user.name} <${user.email}>` });
  await save(mom, 'send');
  return { status: 200, body: mom };
}
