import { Router } from 'express';
import { UserRole, ReviewMeetingStatus, ClaimStatus } from '../../serverTypes';
import { state } from '../state';
import { getUser } from '../middleware/auth';

export const activityRouter = Router();

// Outbox API
activityRouter.get('/outbox', (req, res) => {
  const user = getUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const base = user.role === UserRole.ADMIN
    ? [...state.emails, ...state.teamsMessages]
    : [...state.emails, ...state.teamsMessages].filter(e => e.recipient_id === user.id);
  const sorted = [...base].sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const { page, pageSize, search } = req.query;

  let filtered = sorted;
  if (typeof search === 'string' && search.trim()) {
    const q = search.trim().toLowerCase();
    filtered = filtered.filter(e => {
      const recipient = state.users.find(u => u.id === e.recipient_id);
      return (
        e.subject.toLowerCase().includes(q) ||
        e.body.toLowerCase().includes(q) ||
        (recipient?.name || '').toLowerCase().includes(q) ||
        (recipient?.email || e.to || '').toLowerCase().includes(q)
      );
    });
  }

  if (page && pageSize) {
    const p = Math.max(1, parseInt(page as string, 10) || 1);
    const ps = Math.max(1, parseInt(pageSize as string, 10) || 25);
    const total = filtered.length;
    const items = filtered.slice((p - 1) * ps, p * ps);
    const unreadTotal = base.filter(e => !e.read).length;
    return res.json({ items, total, page: p, pageSize: ps, unreadTotal });
  }

  res.json(filtered);
});

activityRouter.put('/outbox/read', (req, res) => {
  const user = getUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const { ids } = req.body;
  if (Array.isArray(ids)) {
    [...state.emails, ...state.teamsMessages].forEach(e => {
      if (ids.includes(e.id) && (e.recipient_id === user.id || user.role === UserRole.ADMIN)) {
        e.read = true;
      }
    });
  }
  res.json({ success: true });
});

// Activity Status & Seen endpoints
activityRouter.get('/activity/status', (req, res) => {
  const user = getUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const activeMeetingStatuses = [ReviewMeetingStatus.PENDING_CONFIRMATION, ReviewMeetingStatus.CONFIRMED, ReviewMeetingStatus.DECLINE_REQUESTED];
  let calendarCount = 0;
  if (user.role === UserRole.REQUESTOR) {
    calendarCount = state.reviewMeetings.filter(rm => rm.requestor_id === user.id && activeMeetingStatuses.includes(rm.status)).length;
  } else if (user.role === UserRole.APPROVER) {
    const reporteeIds = state.users.filter(u => u.reports_to === user.id).map(u => u.id);
    calendarCount = state.reviewMeetings.filter(rm => (rm.requestor_id === user.id || rm.approver_id === user.id || reporteeIds.includes(rm.requestor_id)) && activeMeetingStatuses.includes(rm.status)).length;
  }

  const emailsCount = [...state.emails, ...state.teamsMessages].filter(e => e.recipient_id === user.id && !e.read).length;

  let inboxCount = 0;
  if (user.role === UserRole.APPROVER) {
    const pendingClaims = state.claims.filter(c => c.status === ClaimStatus.PENDING_APPROVAL && c.current_approver_id === user.id);
    const returnedClaims = state.claims.filter(c => c.status === ClaimStatus.RETURNED && c.requestor_id === user.id);
    const pendingMeetingConfirmations = state.reviewMeetings.filter(rm => rm.approver_id === user.id && rm.status === ReviewMeetingStatus.PENDING_CONFIRMATION);
    inboxCount = pendingClaims.length + returnedClaims.length + pendingMeetingConfirmations.length;
  }

  let processingCount = 0;
  if (user.role === UserRole.CUSTODIAN) {
    processingCount = state.claims.filter(c => c.status === ClaimStatus.PROCESSING).length;
  }

  let dashboardCount = 0;
  if (user.role === UserRole.REQUESTOR) {
    dashboardCount = state.claims.filter(c => c.requestor_id === user.id && c.status === ClaimStatus.RETURNED).length;
  }

  let readyToClaimCount = 0;
  if (user.role === UserRole.REQUESTOR) {
    readyToClaimCount = state.claims.filter(c => c.requestor_id === user.id && c.status === ClaimStatus.READY_FOR_CLAIM).length;
  }

  res.json({
    calendar: calendarCount,
    emails: emailsCount,
    inbox: inboxCount,
    processing: processingCount,
    dashboard: dashboardCount,
    readyToClaim: readyToClaimCount
  });
});

activityRouter.post('/activity/seen', (req, res) => {
  const user = getUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const { section } = req.body;
  if (!section) return res.status(400).json({ error: 'Section is required' });

  if (!state.lastSeenStore[user.id]) {
    state.lastSeenStore[user.id] = {};
  }
  state.lastSeenStore[user.id][section] = new Date().toISOString();

  res.json({ success: true, timestamp: state.lastSeenStore[user.id][section] });
});

// All history for admin
activityRouter.get('/history', (req, res) => {
  const user = getUser(req);
  if (!user || user.role !== UserRole.ADMIN) return res.status(403).json({ error: 'Forbidden' });

  const enriched = state.statusHistories.map(h => {
    const claim = state.claims.find(c => c.id === h.claim_id);
    const changedBy = state.users.find(u => u.id === h.changed_by);
    const targetUser = h.user_id ? state.users.find(u => u.id === h.user_id) : undefined;
    return { ...h, claim, changedBy, targetUser };
  }).sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const { page, pageSize, search, limit, role, status, dateFrom, dateTo } = req.query;

  let filtered = enriched;
  if (typeof search === 'string' && search.trim()) {
    const q = search.trim().toLowerCase();
    filtered = filtered.filter(e =>
      [e.changedBy?.name, e.claim?.claim_number, e.new_status, e.old_status, e.reason, e.targetUser?.name, (e as any).master_data_key]
        .some(v => (v || '').toString().toLowerCase().includes(q))
    );
  }
  if (typeof role === 'string' && role.trim()) {
    const normalizedRole = role.trim().toLowerCase();
    filtered = filtered.filter(e => (e.changedBy?.role || '').toLowerCase() === normalizedRole);
  }
  if (typeof status === 'string' && status.trim()) {
    const normalizedStatus = status.trim().toLowerCase();
    filtered = filtered.filter(e => (e.new_status || '').toLowerCase() === normalizedStatus);
  }
  if (typeof dateFrom === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateFrom)) {
    const start = new Date(`${dateFrom}T00:00:00`).getTime();
    filtered = filtered.filter(e => new Date(e.timestamp).getTime() >= start);
  }
  if (typeof dateTo === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateTo)) {
    const end = new Date(`${dateTo}T23:59:59.999`).getTime();
    filtered = filtered.filter(e => new Date(e.timestamp).getTime() <= end);
  }

  if (page && pageSize) {
    const p = Math.max(1, parseInt(page as string, 10) || 1);
    const ps = Math.max(1, parseInt(pageSize as string, 10) || 25);
    const total = filtered.length;
    const items = filtered.slice((p - 1) * ps, p * ps);
    return res.json({ items, total, page: p, pageSize: ps });
  }

  if (limit) {
    const n = Math.max(1, parseInt(limit as string, 10) || 5);
    return res.json(filtered.slice(0, n));
  }

  res.json(filtered);
});

// Unified admin activity feed: user actions, automated system events, and
// outbound notifications share one chronological stream.
activityRouter.get('/system-activity', (req, res) => {
  const user = getUser(req);
  if (!user || user.role !== UserRole.ADMIN) return res.status(403).json({ error: 'Forbidden' });

  type UnifiedActivity = {
    id: string;
    source: 'audit' | 'notification';
    activityType: 'client' | 'system';
    timestamp: string;
    actor?: { name: string; role: UserRole };
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
  };

  const auditItems: UnifiedActivity[] = state.statusHistories.map(history => {
    const claim = state.claims.find(c => c.id === history.claim_id);
    const changedBy = state.users.find(u => u.id === history.changed_by);
    const targetUser = history.user_id ? state.users.find(u => u.id === history.user_id) : undefined;
    const subject = claim?.claim_number || targetUser?.name || (history as any).master_data_key || 'System';
    return {
      id: `audit-${history.id}`,
      source: 'audit',
      activityType: changedBy ? 'client' : 'system',
      timestamp: history.timestamp,
      actor: changedBy ? { name: changedBy.name, role: changedBy.role } : undefined,
      subject,
      oldStatus: history.old_status,
      newStatus: history.new_status,
      action: history.old_status && history.old_status !== history.new_status
        ? `${history.old_status} → ${history.new_status}`
        : history.new_status,
      details: history.reason || 'Recorded by the system.',
    };
  });

  const notificationItems: UnifiedActivity[] = [...state.emails, ...state.teamsMessages].map(message => {
    const recipient = state.users.find(u => u.id === message.recipient_id);
    const channel: 'Email' | 'Teams' = message.channel === 'Teams' ? 'Teams' : 'Email';
    return {
      id: `notification-${message.id}`,
      source: 'notification',
      activityType: 'system',
      timestamp: message.timestamp,
      recipient: {
        id: message.recipient_id,
        name: recipient?.name || message.to || 'Unknown recipient',
        email: recipient?.email || message.to || '',
      },
      subject: message.subject,
      action: `${channel} notification sent`,
      details: message.body,
      notification: {
        id: message.id,
        recipient_id: message.recipient_id,
        from: message.from,
        to: message.to,
        subject: message.subject,
        body: message.body,
        read: message.read,
        timestamp: message.timestamp,
        channel,
      },
    };
  });

  let filtered = [...auditItems, ...notificationItems]
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  const { page, pageSize, search, activityType, source, role, status, dateFrom, dateTo } = req.query;

  if (typeof search === 'string' && search.trim()) {
    const query = search.trim().toLowerCase();
    filtered = filtered.filter(item =>
      [
        item.actor?.name,
        item.actor?.role,
        item.recipient?.name,
        item.recipient?.email,
        item.subject,
        item.action,
        item.details,
        item.newStatus,
      ].some(value => (value || '').toLowerCase().includes(query))
    );
  }
  if (activityType === 'client' || activityType === 'system') {
    filtered = filtered.filter(item => item.activityType === activityType);
  }
  if (source === 'audit' || source === 'notification') {
    filtered = filtered.filter(item => item.source === source);
  }
  if (typeof role === 'string' && role.trim()) {
    const normalizedRole = role.trim().toLowerCase();
    filtered = filtered.filter(item => (item.actor?.role || '').toLowerCase() === normalizedRole);
  }
  if (typeof status === 'string' && status.trim()) {
    const normalizedStatus = status.trim().toLowerCase();
    filtered = filtered.filter(item => (item.newStatus || '').toLowerCase() === normalizedStatus);
  }
  if (typeof dateFrom === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateFrom)) {
    const start = new Date(`${dateFrom}T00:00:00`).getTime();
    filtered = filtered.filter(item => new Date(item.timestamp).getTime() >= start);
  }
  if (typeof dateTo === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateTo)) {
    const end = new Date(`${dateTo}T23:59:59.999`).getTime();
    filtered = filtered.filter(item => new Date(item.timestamp).getTime() <= end);
  }

  const p = Math.max(1, parseInt(page as string, 10) || 1);
  const ps = Math.max(1, parseInt(pageSize as string, 10) || 25);
  const total = filtered.length;
  res.json({ items: filtered.slice((p - 1) * ps, p * ps), total, page: p, pageSize: ps });
});
