import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import {
  UserRole, SupportRequest, SupportRequestMessage,
  SupportRequestStatus, SupportRequestPriority
} from '../../lib/db/serverTypes';
import { state } from '../../server/state';
import { getUser } from '../../server/middleware/auth';
import { sendEmail } from '../../server/services/notifications';
import { persistSupportRequest, insertSupportMessage } from '../../lib/db/workflowExtrasRepo';

export const supportRouter = Router();

supportRouter.get('/support', (req, res) => {
  const user = getUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  let userRequests = state.supportRequests;
  if (user.role !== UserRole.ADMIN) {
    userRequests = state.supportRequests.filter(sr => sr.requestor_id === user.id);
  }

  res.json(userRequests);
});

supportRouter.get('/support/:id', (req, res) => {
  const user = getUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const request = state.supportRequests.find(sr => sr.id === req.params.id);
  if (!request) return res.status(404).json({ error: 'Not found' });

  if (user.role !== UserRole.ADMIN && request.requestor_id !== user.id) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const messages = state.supportMessages.filter(sm => sm.request_id === request.id)
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  res.json({ ...request, messages });
});

supportRouter.post('/support', async (req, res) => {
  const user = getUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  if (user.role === UserRole.ADMIN) return res.status(403).json({ error: 'Admins manage support requests and cannot file their own.' });

  const { subject, description, related_entity_type, related_entity_id, priority } = req.body;

  const newRequest: SupportRequest = {
    id: uuidv4(),
    requestor_id: user.id,
    subject,
    description,
    related_entity_type,
    related_entity_id,
    priority: priority || SupportRequestPriority.LOW,
    status: SupportRequestStatus.OPEN,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  state.supportRequests.push(newRequest);

  // Notify Admins
  const admins = state.users.filter(u => u.role === UserRole.ADMIN);
  admins.forEach(admin => {
    sendEmail(
      admin.id,
      `New Support Request: ${subject}`,
      `A new support request has been created by ${user.name}.\n\nPriority: ${newRequest.priority}\nSubject: ${subject}\nDescription: ${description}`,
    );
  });

  try {
    await persistSupportRequest(newRequest);
  } catch (err) {
    console.error('[db] Could not persist new support request to Postgres:', err);
  }
  res.status(201).json(newRequest);
});

supportRouter.post('/support/:id/messages', async (req, res) => {
  const user = getUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const request = state.supportRequests.find(sr => sr.id === req.params.id);
  if (!request) return res.status(404).json({ error: 'Not found' });

  if (user.role !== UserRole.ADMIN && request.requestor_id !== user.id) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const { message } = req.body;

  const newMessage: SupportRequestMessage = {
    id: uuidv4(),
    request_id: request.id,
    sender_id: user.id,
    message,
    timestamp: new Date().toISOString()
  };

  state.supportMessages.push(newMessage);
  request.updated_at = newMessage.timestamp;

  if (user.id === request.requestor_id) {
    if (request.assigned_admin_id) {
      sendEmail(request.assigned_admin_id, `New message on Support Request: ${request.subject}`, `${user.name}: ${message}`);
    }
  } else {
    sendEmail(request.requestor_id, `New message on Support Request: ${request.subject}`, `${user.name}: ${message}`);
  }

  try {
    await persistSupportRequest(request);
    await insertSupportMessage(newMessage);
  } catch (err) {
    console.error('[db] Could not persist support message to Postgres:', err);
  }
  res.status(201).json(newMessage);
});

supportRouter.put('/support/:id', async (req, res) => {
  const user = getUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const request = state.supportRequests.find(sr => sr.id === req.params.id);
  if (!request) return res.status(404).json({ error: 'Not found' });

  if (user.role !== UserRole.ADMIN && request.requestor_id !== user.id) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  if (req.body.status) {
    const oldStatus = request.status;
    request.status = req.body.status;
    if (oldStatus !== request.status && request.status === SupportRequestStatus.RESOLVED) {
      sendEmail(request.requestor_id, `Support Request Resolved: ${request.subject}`, 'Your support request has been marked as resolved.');
    }
  }

  if (req.body.priority && user.role === UserRole.ADMIN) {
    request.priority = req.body.priority;
  }

  if (req.body.assigned_admin_id && user.role === UserRole.ADMIN) {
    request.assigned_admin_id = req.body.assigned_admin_id;
  }

  request.updated_at = new Date().toISOString();

  try {
    await persistSupportRequest(request);
  } catch (err) {
    console.error('[db] Could not persist support request changes to Postgres:', err);
  }
  res.json(request);
});
