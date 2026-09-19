import { MasterData } from '../types';
import { apiFetch } from '../../../lib/api/client';

export function toQueryString(params?: Record<string, string | number | undefined>): string {
  if (!params) return '';
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== '');
  if (entries.length === 0) return '';
  return '?' + new URLSearchParams(entries.map(([k, v]) => [k, String(v)])).toString();
}

export interface PageResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  /** Present on /api/outbox only: unread count across the whole (unsearched) set. */
  unreadTotal?: number;
}

/** Admin: update system settings (payment methods, high-value threshold, category limits). */
export const updateAdminSettings = (body: Record<string, unknown>) =>
  apiFetch('/api/admin/settings', { method: 'PUT', body: JSON.stringify(body) });

/**
 * Full immutable event feed — admin only. Fetched on demand by the Audit page.
 * With no args, returns the plain array (AdminDashboard's "recent activity"
 * call, via `limit`). With `page`/`pageSize`, the server returns a
 * `PageResult` instead — that's the shape AuditLog.tsx uses.
 */
export const fetchAuditHistory = (params?: {
  page?: number;
  pageSize?: number;
  search?: string;
  limit?: number;
  role?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
}) =>
  apiFetch(`/api/history${toQueryString(params as any)}`);

export interface SystemActivityEntry {
  id: string;
  source: 'audit' | 'notification';
  activityType: 'client' | 'system';
  timestamp: string;
  actor?: { name: string; role: string };
  recipient?: { id: string; name: string; email: string };
  subject: string;
  oldStatus?: string;
  newStatus?: string;
  action: string;
  details: string;
  notification?: {
    id: string;
    recipient_id: string;
    from: string;
    to: string;
    subject: string;
    body: string;
    read: boolean;
    timestamp: string;
    channel: 'Email' | 'Teams';
  };
}

export const fetchSystemActivity = async (params: {
  page?: number;
  pageSize?: number;
  search?: string;
  activityType?: 'client' | 'system' | '';
  source?: 'audit' | 'notification' | '';
  role?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
} = {}): Promise<PageResult<SystemActivityEntry>> => {
  const [history, outbox] = await Promise.all([
    apiFetch<any[]>('/api/history'),
    apiFetch<any[]>('/api/outbox'),
  ]);

  const auditItems: SystemActivityEntry[] = (history || []).map(entry => {
    const subject = entry.claim?.claim_number || entry.targetUser?.name || entry.master_data_key || 'System';
    return {
      id: `audit-${entry.id}`,
      source: 'audit',
      activityType: entry.changedBy ? 'client' : 'system',
      timestamp: entry.timestamp,
      actor: entry.changedBy ? { name: entry.changedBy.name, role: entry.changedBy.role } : undefined,
      subject,
      oldStatus: entry.old_status,
      newStatus: entry.new_status,
      action: entry.old_status && entry.old_status !== entry.new_status
        ? `${entry.old_status} → ${entry.new_status}`
        : entry.new_status,
      details: entry.reason || 'Recorded by the system.',
    };
  });
  const notificationItems: SystemActivityEntry[] = (outbox || []).map(entry => {
    const channel: 'Email' | 'Teams' = entry.channel === 'Teams' ? 'Teams' : 'Email';
    return {
      id: `notification-${entry.id}`,
      source: 'notification',
      activityType: 'system',
      timestamp: entry.timestamp,
      recipient: {
        id: entry.recipient_id,
        name: entry.to || 'Unknown recipient',
        email: entry.to || '',
      },
      subject: entry.subject || 'Notification',
      action: `${channel} notification sent`,
      details: entry.body || '',
      notification: {
        id: entry.id,
        recipient_id: entry.recipient_id,
        from: entry.from || 'no-reply@mgenesis.com',
        to: entry.to || '',
        subject: entry.subject || '',
        body: entry.body || '',
        read: Boolean(entry.read),
        timestamp: entry.timestamp,
        channel,
      },
    };
  });

  let items = [...auditItems, ...notificationItems]
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  const query = params.search?.trim().toLowerCase();
  if (query) {
    items = items.filter(item => [
      item.actor?.name,
      item.actor?.role,
      item.recipient?.name,
      item.recipient?.email,
      item.subject,
      item.action,
      item.details,
      item.newStatus,
    ].some(value => (value || '').toLowerCase().includes(query)));
  }
  if (params.activityType) items = items.filter(item => item.activityType === params.activityType);
  if (params.source) items = items.filter(item => item.source === params.source);
  if (params.role) items = items.filter(item => (item.actor?.role || '') === params.role);
  if (params.status) items = items.filter(item => (item.newStatus || '') === params.status);
  if (params.dateFrom) {
    const start = new Date(`${params.dateFrom}T00:00:00`).getTime();
    items = items.filter(item => new Date(item.timestamp).getTime() >= start);
  }
  if (params.dateTo) {
    const end = new Date(`${params.dateTo}T23:59:59.999`).getTime();
    items = items.filter(item => new Date(item.timestamp).getTime() <= end);
  }

  const page = Math.max(1, params.page || 1);
  const pageSize = Math.max(1, params.pageSize || 25);
  const total = items.length;
  return {
    items: items.slice((page - 1) * pageSize, page * pageSize),
    total,
    page,
    pageSize,
  };
};

/**
 * The master-data route key is the plural-kebab form; the UI's MasterData.type
 * is singular-camel. This is the single place that bridges the two.
 */
const MASTER_ROUTE_KEY: Record<MasterData['type'], string> = {
  department: 'departments',
  costCenter: 'cost-centers',
  businessUnit: 'business-units',
  branch: 'branches',
  projectCode: 'project-codes',
  vendor: 'vendors',
};

export type MasterDataInput = { name?: string; code?: string; notes?: string; active?: boolean };

export const createMasterData = (type: MasterData['type'], body: MasterDataInput) =>
  apiFetch(`/api/master-data/${MASTER_ROUTE_KEY[type]}`, {
    method: 'POST',
    body: JSON.stringify(body),
  });

export const updateMasterData = (type: MasterData['type'], id: string, body: MasterDataInput) =>
  apiFetch(`/api/master-data/${MASTER_ROUTE_KEY[type]}/${id}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });

/** Field definitions — admin-configurable dynamic form fields. */
export const createFieldDefinition = (body: Record<string, unknown>) =>
  apiFetch('/api/field-definitions', { method: 'POST', body: JSON.stringify(body) });

export const updateFieldDefinition = (id: string, body: Record<string, unknown>) =>
  apiFetch(`/api/field-definitions/${id}`, { method: 'PUT', body: JSON.stringify(body) });

/** Users — the admin can edit an account (role, manager, status, etc.). */
export const updateUser = (id: string, body: Record<string, unknown>) =>
  apiFetch(`/api/users/${id}`, { method: 'PUT', body: JSON.stringify(body) });

/** Company directory. */
export const createCompany = (body: Record<string, unknown>) =>
  apiFetch('/api/companies', { method: 'POST', body: JSON.stringify(body) });

export const updateCompany = (id: string, body: Record<string, unknown>) =>
  apiFetch(`/api/companies/${id}`, { method: 'PUT', body: JSON.stringify(body) });

export interface CompanyImportResult {
  inserted: number;
  updated: number;
  skipped: number;
  total: number;
  errors: Array<{ row: number; error: string }>;
}

export const importCompanies = (companies: Array<Record<string, string>>) =>
  apiFetch<CompanyImportResult>('/api/companies/import', {
    method: 'POST',
    body: JSON.stringify({ companies }),
  });

/** One row of a parsed historical-import CSV, already resolved to a requestor. */
export interface HistoricalImportRecord {
  requestor_id: string;
  total_amount: number;
  expense_category: string;
  remarks?: string;
  created_at?: string;
  lineItems: Array<{
    expense_date: string;
    vendor: string;
    category: string;
    amount: number;
    payment_method: string;
    business_purpose: string;
  }>;
}

/** Admin: bulk-create historical (already-completed) claims from a parsed import file. */
export const importHistoricalClaims = (filename: string, records: HistoricalImportRecord[]) =>
  apiFetch('/api/imports', {
    method: 'POST',
    body: JSON.stringify({ filename, records }),
  });
