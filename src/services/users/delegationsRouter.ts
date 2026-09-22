import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { UserRole, ApproverDelegation, DelegationStatus } from '../../lib/db/serverTypes';
import { state } from '../../server/state';
import { getUser } from '../../server/middleware/auth';
import { syncDelegationStatuses } from '../../server/services/delegations';
import { addDelegationHistory } from '../../server/services/history';
import { sendEmail } from '../../server/services/notifications';
import { persistDelegation } from '../../lib/db/workflowExtrasRepo';

export const delegationsRouter = Router();

delegationsRouter.get('/delegations', (req, res) => {
  const user = getUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  syncDelegationStatuses();
  const relevant = state.delegations.filter(d => d.approver_id === user.id || d.delegate_id === user.id);
  const enriched = relevant.map(d => ({
    ...d,
    approver: state.users.find(u => u.id === d.approver_id),
    delegate: state.users.find(u => u.id === d.delegate_id)
  })).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  res.json(enriched);
});

delegationsRouter.post('/delegations', async (req, res) => {
  const user = getUser(req);
  if (!user || user.role !== UserRole.APPROVER) return res.status(403).json({ error: 'Forbidden' });

  const { delegate_id, start_date, end_date } = req.body;
  if (!delegate_id || !start_date || !end_date) {
    return res.status(400).json({ error: 'Delegate, start date, and end date are all required.' });
  }
  if (delegate_id === user.id) {
    return res.status(400).json({ error: 'You cannot delegate to yourself.' });
  }
  const delegate = state.users.find(u => u.id === delegate_id);
  if (!delegate || delegate.role !== UserRole.APPROVER) {
    return res.status(400).json({ error: 'You can only delegate to another Approver.' });
  }
  if (new Date(start_date) > new Date(end_date)) {
    return res.status(400).json({ error: 'The start date cannot be after the end date.' });
  }

  const id = uuidv4();
  const now = new Date().toISOString();
  const delegation: ApproverDelegation = {
    id,
    approver_id: user.id,
    delegate_id,
    start_date,
    end_date,
    status: DelegationStatus.PENDING,
    created_by: user.id,
    created_at: now,
    updated_at: now
  };
  state.delegations.push(delegation);
  try {
    await persistDelegation(delegation);
  } catch (err) {
    console.error('[db] Could not persist new delegation to Postgres:', err);
  }
  addDelegationHistory(id, '', DelegationStatus.PENDING, user.id, `Delegation requested to ${delegate.name}`);

  sendEmail(
    delegate_id,
    `Delegation Request from ${user.name}`,
    `${user.name} has asked you to cover their approval duties from ${start_date} to ${end_date}.\n\nPlease log in and Accept or Decline this request from Settings > Approval Delegation. Your decision does not take effect until you respond - claims will keep routing to ${user.name} until then.`,
    undefined,
    { eventKey: 'delegation' }
  );

  res.json(delegation);
});

delegationsRouter.post('/delegations/:id/accept', async (req, res) => {
  const user = getUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  syncDelegationStatuses();

  const delegation = state.delegations.find(d => d.id === req.params.id);
  if (!delegation) return res.status(404).json({ error: 'Delegation not found' });
  if (delegation.delegate_id !== user.id) return res.status(403).json({ error: 'Forbidden' });
  if (delegation.status !== DelegationStatus.PENDING) {
    return res.status(400).json({ error: `This request is ${delegation.status.toLowerCase()} and can no longer be accepted.` });
  }

  const oldStatus = delegation.status;
  delegation.status = DelegationStatus.ACTIVE;
  delegation.updated_at = new Date().toISOString();
  addDelegationHistory(delegation.id, oldStatus, DelegationStatus.ACTIVE, user.id, 'Delegation accepted');

  sendEmail(
    delegation.approver_id,
    `${user.name} accepted your delegation request`,
    `${user.name} has accepted your request to cover approvals from ${delegation.start_date} to ${delegation.end_date}. Claims from your direct reports will now route to them for that period.`,
    undefined,
    { eventKey: 'delegation' }
  );

  try {
    await persistDelegation(delegation);
  } catch (err) {
    console.error('[db] Could not persist delegation acceptance to Postgres:', err);
  }
  res.json(delegation);
});

delegationsRouter.post('/delegations/:id/decline', async (req, res) => {
  const user = getUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const delegation = state.delegations.find(d => d.id === req.params.id);
  if (!delegation) return res.status(404).json({ error: 'Delegation not found' });
  if (delegation.delegate_id !== user.id) return res.status(403).json({ error: 'Forbidden' });
  if (delegation.status !== DelegationStatus.PENDING) {
    return res.status(400).json({ error: `This request is ${delegation.status.toLowerCase()} and can no longer be declined.` });
  }

  const { reason } = req.body;
  const oldStatus = delegation.status;
  delegation.status = DelegationStatus.DECLINED;
  delegation.decline_reason = reason || undefined;
  delegation.updated_at = new Date().toISOString();
  addDelegationHistory(delegation.id, oldStatus, DelegationStatus.DECLINED, user.id, reason || 'Delegation declined');

  sendEmail(
    delegation.approver_id,
    `${user.name} declined your delegation request`,
    `${user.name} has declined your request to cover approvals from ${delegation.start_date} to ${delegation.end_date}.${reason ? `\n\nReason: ${reason}` : ''}\n\nPlease choose a different delegate if you still need coverage for this period.`,
    undefined,
    { eventKey: 'delegation' }
  );

  try {
    await persistDelegation(delegation);
  } catch (err) {
    console.error('[db] Could not persist delegation decline to Postgres:', err);
  }
  res.json(delegation);
});

delegationsRouter.post('/delegations/:id/cancel', async (req, res) => {
  const user = getUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const delegation = state.delegations.find(d => d.id === req.params.id);
  if (!delegation) return res.status(404).json({ error: 'Delegation not found' });
  if (delegation.approver_id !== user.id) return res.status(403).json({ error: 'Forbidden' });
  if (delegation.status !== DelegationStatus.PENDING && delegation.status !== DelegationStatus.ACTIVE) {
    return res.status(400).json({ error: `This delegation is already ${delegation.status.toLowerCase()}.` });
  }

  const oldStatus = delegation.status;
  delegation.status = DelegationStatus.CANCELLED;
  delegation.updated_at = new Date().toISOString();
  addDelegationHistory(delegation.id, oldStatus, DelegationStatus.CANCELLED, user.id, 'Delegation cancelled by approver');

  sendEmail(
    delegation.delegate_id,
    `${user.name} cancelled their delegation request`,
    `${user.name} has cancelled the delegation ${oldStatus === DelegationStatus.ACTIVE ? 'that was active' : 'request'} covering ${delegation.start_date} to ${delegation.end_date}. ${oldStatus === DelegationStatus.ACTIVE ? 'You no longer need to act on their behalf.' : 'No action is needed.'}`,
    undefined,
    { eventKey: 'delegation' }
  );

  try {
    await persistDelegation(delegation);
  } catch (err) {
    console.error('[db] Could not persist delegation cancellation to Postgres:', err);
  }
  res.json(delegation);
});
