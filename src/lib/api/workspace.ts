import {
  Claim, ExpenseLineItem, MOM, User, StatusHistory, MasterData, FieldDefinition,
  Company, SystemEmail, SupportRequest, ApproverDelegation, NotificationPrefs,
  ReviewMeeting,
} from '../../types';
import { apiFetch } from './client';
import { toQueryString } from './admin';
import {
  fromServerClaim, fromServerCashAdvance, fromServerLiquidation, fromServerExpense,
  fromServerMom, fromServerHistory, fromServerUser, fromServerReviewMeeting,
  fromServerMasterData, fromServerFieldDefinition, fromServerEmail,
  fromServerSupport, fromServerDelegation,
} from './adapters';

export interface WorkspaceData {
  currentUser: User;
  users: User[];
  claims: Claim[];
  lineItems: ExpenseLineItem[];
  moms: MOM[];
  reviewMeetings: ReviewMeeting[];
  statusHistory: StatusHistory[];
  masterData: MasterData[];
  fieldDefinitions: FieldDefinition[];
  companies: Company[];
  emails: SystemEmail[];
  supportRequests: SupportRequest[];
  delegations: ApproverDelegation[];
  paymentMethods: string[];
  /** Admin-configurable amount above which a line item is flagged high-value. */
  highValueThreshold: number;
  /** Company spending policy: max amount per line item, keyed by expense category. */
  categoryLimits: Record<string, number>;
  /** Master deployment switch; false means all demo-only UI is unavailable. */
  demoModeEnabled: boolean;
}

/**
 * One shot at everything the app's context needs. The three claim-ish
 * collections are fetched separately (they're separate resources server-side)
 * and merged here so components only ever see one list.
 */
export async function loadWorkspace(): Promise<WorkspaceData> {
  const [me, users, rawClaims, rawAdvances, rawLiquidations, masterAll, rawFields, rawMoms, rawReviewMeetings, rawCompanies, rawOutbox, rawSupport, rawDelegations, rawSettings, runtimeConfig] =
    await Promise.all([
      apiFetch('/api/me'),
      apiFetch('/api/users'),
      apiFetch('/api/claims'),
      apiFetch('/api/cash-advances'),
      apiFetch('/api/liquidations'),
      apiFetch('/api/master-data/all'),
      apiFetch('/api/field-definitions'),
      apiFetch('/api/moms'),
      apiFetch('/api/review-meetings'),
      apiFetch('/api/companies'),
      apiFetch('/api/outbox'),
      apiFetch('/api/support'),
      apiFetch('/api/delegations'),
      apiFetch('/api/admin/settings'),
      apiFetch('/api/auth/config'),
    ]);

  const demoModeEnabled = runtimeConfig?.demoModeEnabled === true;
  const claims: Claim[] = [
    ...(rawClaims || []).map((c: any) => fromServerClaim(c, demoModeEnabled)),
    ...(rawAdvances || []).map(fromServerCashAdvance),
    ...(rawLiquidations || []).map(fromServerLiquidation),
  ];

  const lineItems: ExpenseLineItem[] = [
    ...(rawClaims || []).flatMap((c: any) =>
      (c.expenses || []).map((e: any) => fromServerExpense(e, c.id))
    ),
    ...(rawLiquidations || []).flatMap((l: any) =>
      (l.lineItems || []).map((e: any) => fromServerExpense(e, l.id))
    ),
  ];

  const moms = (rawMoms || []).map(fromServerMom).filter(Boolean) as MOM[];

  const statusHistory = [
    ...(rawClaims || []).flatMap((c: any) =>
      (c.history || []).map((h: any) => fromServerHistory(h, c.id, 'Reimbursement'))
    ),
    ...(rawAdvances || []).flatMap((ca: any) =>
      (ca.history || []).map((h: any) => fromServerHistory(h, ca.id, 'Cash Advance'))
    ),
    ...(rawLiquidations || []).flatMap((l: any) =>
      (l.history || []).map((h: any) => fromServerHistory(h, l.id, 'Liquidation'))
    ),
  ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return {
    currentUser: fromServerUser(me),
    users: (users || []).map(fromServerUser),
    claims: claims.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    ),
    lineItems,
    moms,
    reviewMeetings: (rawReviewMeetings || []).map(fromServerReviewMeeting),
    statusHistory,
    masterData: fromServerMasterData(masterAll),
    fieldDefinitions: (rawFields || []).map(fromServerFieldDefinition),
    companies: (rawCompanies || []).map((c: any): Company => ({
      id: c.id, name: c.name, industry: c.industry || undefined, notes: c.notes || undefined,
      address: c.address || undefined,
      contactPerson: c.contact_person || undefined,
      contactEmail: c.contact_email || undefined,
      pendingReview: Boolean(c.pending_review),
      createdBy: c.created_by || undefined,
    })),
    emails: (rawOutbox || []).map(fromServerEmail),
    supportRequests: (rawSupport || []).map(fromServerSupport),
    delegations: (rawDelegations || []).map(fromServerDelegation),
    paymentMethods: rawSettings?.paymentMethods || ['Cash', 'GCash', 'Bank Transfer', 'Check'],
    highValueThreshold: Number(rawSettings?.highValueThreshold) || 15000,
    categoryLimits: (rawSettings?.categoryLimits && typeof rawSettings.categoryLimits === 'object') ? rawSettings.categoryLimits : {},
    demoModeEnabled,
  };
}

/**
 * Admin's full outbox, paginated + searched server-side. With no args this
 * is the same plain array `loadWorkspace` has always fetched; with
 * `page`/`pageSize` the server returns a `PageResult` — used by the
 * System Emails admin page instead of paging through the context copy.
 */
export const fetchOutbox = (params?: { page?: number; pageSize?: number; search?: string }) =>
  apiFetch(`/api/outbox${toQueryString(params as any)}`);

/** One support request with its full message thread. */
export const fetchSupportRequest = (id: string) => apiFetch(`/api/support/${id}`);

export const createSupportRequest = (body: {
  subject: string; description: string; priority: string;
  related_entity_type?: string; related_entity_id?: string;
}) => apiFetch('/api/support', { method: 'POST', body: JSON.stringify(body) });

export const addSupportMessage = (id: string, message: string) =>
  apiFetch(`/api/support/${id}/messages`, { method: 'POST', body: JSON.stringify({ message }) });

export const updateSupportStatus = (id: string, status: string) =>
  apiFetch(`/api/support/${id}`, { method: 'PUT', body: JSON.stringify({ status }) });

/** Mark outbox emails read. Ignore failures — it's a cosmetic read-state update. */
export const markEmailsRead = (ids: string[]) =>
  apiFetch('/api/outbox/read', { method: 'PUT', body: JSON.stringify({ ids }) }).catch(() => {});

// --- delegation lifecycle ---------------------------------------------------

/** Approver requests coverage. Starts Pending — routing doesn't change until accepted. */
export const requestDelegation = (delegateId: string, startDate: string, endDate: string) =>
  apiFetch('/api/delegations', {
    method: 'POST',
    body: JSON.stringify({ delegate_id: delegateId, start_date: startDate, end_date: endDate }),
  });

export const acceptDelegation = (id: string) => apiFetch(`/api/delegations/${id}/accept`, { method: 'POST' });

export const declineDelegation = (id: string, reason?: string) =>
  apiFetch(`/api/delegations/${id}/decline`, { method: 'POST', body: JSON.stringify({ reason }) });

/** Approver-side cancel; valid while Pending or Active. */
export const cancelDelegation = (id: string) => apiFetch(`/api/delegations/${id}/cancel`, { method: 'POST' });

// --- self-service settings --------------------------------------------------

export const updateNotificationPrefs = (prefs: NotificationPrefs) =>
  apiFetch('/api/me/notification-prefs', { method: 'PUT', body: JSON.stringify(prefs) });

// --- review-meeting scheduling loop -----------------------------------------

/** Approver (or active delegate) confirms the requestor's proposed time. */
export const confirmReviewMeeting = (id: string) =>
  apiFetch(`/api/review-meetings/${id}/confirm`, { method: 'POST' });

/** Approver (or active delegate) can't make the proposed time. */
export const declineReviewMeeting = (id: string, reason?: string) =>
  apiFetch(`/api/review-meetings/${id}/decline`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });

/** Requestor proposes a new date/time — re-opens pending confirmation. */
export const rescheduleReviewMeeting = (id: string, meetingDate: string, meetingTime: string) =>
  apiFetch(`/api/review-meetings/${id}/reschedule`, {
    method: 'PUT',
    body: JSON.stringify({ meeting_date: meetingDate, meeting_time: meetingTime }),
  });
