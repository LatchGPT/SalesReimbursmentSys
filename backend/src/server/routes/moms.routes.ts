import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { Mom, MomStatus, MinutesSource, UserRole } from '../../serverTypes';
import { state } from '../state';
import { getUser } from '../middleware/auth';
import { canAccessMom } from '../services/authorization';
import { isFinanceVisibleFinancialRecord } from '../constants';
import { getOrCreateCompany } from '../services/companyService';
import { getActiveDelegation } from '../services/delegations';
import { validateRequiredCustomFields } from './fieldDefinitions.routes';
import { sendEmail } from '../services/notifications';
import { persistMom } from '../../db/coreLoopRepo';

export const momsRouter = Router();

// MOM endpoints (accessed for managing meeting notes)
momsRouter.get('/moms', (req, res) => {
  const user = getUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  let relevantMoms: Mom[] = [];
  if (user.role === UserRole.ADMIN) {
    relevantMoms = state.moms; // Admin sees all MOMs
  } else if (user.role === UserRole.CUSTODIAN) {
    // Custodians only need the claim/receipt to verify and release payment;
    // MOM client-meeting content is out of scope for that role.
    relevantMoms = [];
  } else if (user.role === UserRole.FINANCE) {
    // MOM content follows the linked record's Finance boundary; merely
    // submitting a request does not make meeting content Finance-visible.
    relevantMoms = state.moms.filter(m => {
      const claim = state.claims.find(candidate => candidate.id === m.claim_id);
      return Boolean(claim && isFinanceVisibleFinancialRecord(claim.claim_type || 'Reimbursement', claim.status));
    });
  } else if (user.role === UserRole.REQUESTOR) {
    relevantMoms = state.moms.filter(m => m.requestor_id === user.id);
  } else if (user.role === UserRole.APPROVER) {
    const reporteeIds = state.users.filter(u => u.reports_to === user.id).map(u => u.id);
    relevantMoms = state.moms.filter(m =>
      m.requestor_id === user.id ||
      (!!m.claim_id && !!m.requestor_id && reporteeIds.includes(m.requestor_id))
    );
  }

  // Enrich with requestor name
  const enriched = relevantMoms.map(m => {
    const requestor = state.users.find(u => u.id === m.requestor_id);
    return {
      ...m,
      prepared_by: requestor ? requestor.name : (m.prepared_by || 'Unknown'),
      prepared_by_department: requestor ? requestor.department : undefined,
      prepared_by_job_title: requestor ? requestor.job_title : undefined,
      client_name: m.client || m.summary || 'Unknown Client' // for calendar/retro-compatibility
    };
  });

  res.json(enriched);
});

momsRouter.get('/moms/:id', (req, res) => {
  const user = getUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  if (user.role === UserRole.CUSTODIAN) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const mom = state.moms.find(m => m.id === req.params.id);
  if (!mom) return res.status(404).json({ error: 'Minutes of Meeting not found' });

  if (!canAccessMom(user, mom)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const requestor = state.users.find(u => u.id === mom.requestor_id);
  const linkedClaim = mom.claim_id ? state.claims.find(c => c.id === mom.claim_id) : undefined;

  res.json({
    ...mom,
    requestor,
    prepared_by: requestor ? requestor.name : (mom.prepared_by || 'Unknown'),
    prepared_by_department: requestor ? requestor.department : undefined,
    prepared_by_job_title: requestor ? requestor.job_title : undefined,
    linkedClaim,
  });
});

momsRouter.post('/moms', async (req, res) => {
  const user = getUser(req);
  if (!user || !user.reports_to) return res.status(403).json({ error: 'Forbidden: You must have a designated manager (reports_to) to submit.' });

  const mom: Mom = {
    id: uuidv4(),
    requestor_id: user.id,
    document_type: req.body.document_type === 'LOA' ? 'LOA' : 'MoM',
    client: req.body.client || '',
    contact_person: req.body.contact_person || '',
    contact_person_email: req.body.contact_person_email || '',
    cc_client: Boolean(req.body.cc_client),
    meeting_date: req.body.meeting_date || new Date().toISOString().split('T')[0],
    meeting_time: req.body.meeting_time || '',
    location: req.body.location || '',
    purpose: req.body.purpose || '',
    discussion: req.body.discussion || '',
    agreements: req.body.agreements || '',
    action_items: req.body.action_items || '',
    prepared_by: user.name,
    // Smart defaults (Phase 3 MDM) — the logged-in user's department/job
    // title are already known, so there's no reason to ask them again.
    prepared_by_department: user.department,
    prepared_by_job_title: user.job_title,
    file_url: req.body.file_url,
    file_name: req.body.file_name,
    status: req.body.status || MomStatus.DRAFT,
    created_at: new Date().toISOString(),
    minutes_source: req.body.minutes_source || MinutesSource.TEMPLATE,
    meeting_type: req.body.meeting_type || '',
    participants_internal: req.body.participants_internal || '',
    participants_external: req.body.participants_external || '',
    custom_fields: req.body.custom_fields || undefined
  };

  await getOrCreateCompany(mom.client, user.id);
  state.moms.push(mom);
  try {
    await persistMom(mom);
  } catch (err) {
    console.error('[db] Could not persist new MOM to Postgres:', err);
  }
  res.json(mom);
});

momsRouter.put('/moms/:id', async (req, res) => {
  const user = getUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const mom = state.moms.find(m => m.id === req.params.id);
  if (!mom) return res.status(404).json({ error: 'MOM not found' });

  if (user.role === UserRole.REQUESTOR && mom.requestor_id !== user.id) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  if (user.role === UserRole.APPROVER && mom.requestor_id !== user.id) {
    const momOwner = state.users.find(u => u.id === mom.requestor_id);
    let authorized = !!momOwner && momOwner.reports_to === user.id;
    if (!authorized && momOwner?.reports_to) {
      const activeDelegation = getActiveDelegation(momOwner.reports_to);
      authorized = activeDelegation?.delegate_id === user.id;
    }
    if (!authorized) {
      return res.status(403).json({ error: 'Forbidden: not your direct report' });
    }
  }

  mom.client = req.body.client ?? mom.client;
  await getOrCreateCompany(mom.client, user.id);
  mom.contact_person = req.body.contact_person ?? mom.contact_person;
  mom.contact_person_email = req.body.contact_person_email ?? mom.contact_person_email;
  mom.cc_client = req.body.cc_client ?? mom.cc_client;
  mom.meeting_date = req.body.meeting_date ?? mom.meeting_date;
  mom.meeting_time = req.body.meeting_time ?? mom.meeting_time;
  mom.location = req.body.location ?? mom.location;
  mom.purpose = req.body.purpose ?? mom.purpose;
  mom.discussion = req.body.discussion ?? mom.discussion;
  mom.agreements = req.body.agreements ?? mom.agreements;
  mom.action_items = req.body.action_items ?? mom.action_items;
  mom.status = req.body.status ?? mom.status;
  mom.file_url = req.body.file_url ?? mom.file_url;
  mom.file_name = req.body.file_name ?? mom.file_name;
  mom.meeting_type = req.body.meeting_type ?? mom.meeting_type;
  mom.participants_internal = req.body.participants_internal ?? mom.participants_internal;
  mom.participants_external = req.body.participants_external ?? mom.participants_external;
  mom.custom_fields = req.body.custom_fields ?? mom.custom_fields;

  try {
    await persistMom(mom);
  } catch (err) {
    console.error('[db] Could not persist MOM changes to Postgres:', err);
  }
  res.json(mom);
});

momsRouter.post('/moms/:id/send', async (req, res) => {
  const user = getUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const mom = state.moms.find(m => m.id === req.params.id && m.requestor_id === user.id);
  if (!mom) return res.status(404).json({ error: 'MOM not found' });

  // Finalizing (Draft -> Completed) is the actual "submit" moment for a MOM
  // in every current flow (both MomQuickCreateModal and Moms.tsx always
  // POST as Draft first, then call this route) — so required dynamic
  // fields are enforced here, not on the earlier POST/PUT.
  const customFieldError = validateRequiredCustomFields('mom', mom.custom_fields);
  if (customFieldError) return res.status(400).json({ error: customFieldError });

  mom.status = MomStatus.COMPLETED;

  // Send MOM email - 1. MOM Email (To: Contact Person, CC: Approver)
  const approverId = user.reports_to || '';
  const subject = `Meeting Summary - ${mom.client || 'Client'}`;
  const body = `Thank you for meeting with us on ${mom.meeting_date} regarding ${mom.purpose || 'our business discussion'}.

Discussion:
${mom.discussion || 'No discussion points added.'}

Agreements:
${mom.agreements || 'No agreements listed.'}

Action Items:
${mom.action_items || 'No action items listed.'}

Best regards,
${user.name}`;

  sendEmail(
    mom.contact_person_email || 'client@mgenesis.com',
    subject,
    body,
    approverId || undefined,
    { plain: true, recipientName: mom.contact_person || 'Valued Client', fromLabel: `${user.name} <${user.email}>` }
  );

  try {
    await persistMom(mom);
  } catch (err) {
    console.error('[db] Could not persist MOM changes to Postgres:', err);
  }
  res.json(mom);
});
