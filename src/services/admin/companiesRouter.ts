import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { UserRole, Company } from '../../lib/db/serverTypes';
import { state } from '../../server/state';
import { getUser } from '../../server/middleware/auth';
import { addMasterDataHistory } from '../../server/services/history';
import { persistCompany } from '../../lib/db/referenceDataRepo';

export const companiesRouter = Router();

companiesRouter.get('/companies', (req, res) => {
  const user = getUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  res.json([...state.companies].sort((a, b) => a.name.localeCompare(b.name)));
});

companiesRouter.post('/companies', async (req, res) => {
  const user = getUser(req);
  if (!user || user.role !== UserRole.ADMIN) return res.status(403).json({ error: 'Forbidden' });

  const {
    name, industry, notes,
    address, business_unit_id, cost_center_id, default_department_id, currency, tax_id, default_approver_id,
    contact_person, contact_email
  } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'Company name is required.' });
  if (state.companies.some(c => c.name.toLowerCase() === name.trim().toLowerCase())) {
    return res.status(400).json({ error: 'A company with this name already exists.' });
  }

  const company: Company = {
    id: uuidv4(), name: name.trim(), industry, notes,
    address, business_unit_id, cost_center_id, default_department_id, currency, tax_id, default_approver_id,
    contact_person, contact_email,
    pending_review: false,
    created_by: user.id,
  };
  state.companies.push(company);
  try {
    await persistCompany(company);
  } catch (err) {
    console.error('[db] Could not persist new company to Postgres:', err);
  }
  res.json(company);
});

companiesRouter.post('/companies/import', async (req, res) => {
  const user = getUser(req);
  if (!user || user.role !== UserRole.ADMIN) return res.status(403).json({ error: 'Forbidden' });

  const rows = Array.isArray(req.body?.companies) ? req.body.companies : [];
  if (!rows.length) return res.status(400).json({ error: 'The import contains no company rows.' });
  if (rows.length > 5000) return res.status(400).json({ error: 'A single import is limited to 5,000 companies.' });

  let inserted = 0;
  let updated = 0;
  let skipped = 0;
  const errors: Array<{ row: number; error: string }> = [];

  for (const [index, raw] of rows.entries()) {
    const name = String(raw?.name || '').trim();
    if (!name) {
      errors.push({ row: index + 2, error: 'Company name is required.' });
      continue;
    }

    const values = {
      industry: String(raw.industry || '').trim() || undefined,
      notes: String(raw.notes || '').trim() || undefined,
      address: String(raw.address || raw.location || '').trim() || undefined,
      currency: String(raw.currency || '').trim() || undefined,
      tax_id: String(raw.tax_id || raw.taxId || '').trim() || undefined,
      contact_person: String(raw.contact_person || raw.contactPerson || '').trim() || undefined,
      contact_email: String(raw.contact_email || raw.contactEmail || '').trim() || undefined,
    };
    const existing = state.companies.find(company => company.name.toLowerCase() === name.toLowerCase());

    if (!existing) {
      const company: Company = { id: uuidv4(), name, ...values };
      state.companies.push(company);
      addMasterDataHistory('companies', company.id, 'import', '(new)', name, user.id);
      try {
        await persistCompany(company);
      } catch (err) {
        console.error('[db] Could not persist imported company to Postgres:', err);
      }
      inserted++;
      continue;
    }

    let changed = false;
    (Object.keys(values) as Array<keyof typeof values>).forEach(field => {
      const next = values[field];
      if (next !== undefined && existing[field] !== next) {
        addMasterDataHistory('companies', existing.id, field, String(existing[field] ?? '(none)'), next, user.id);
        (existing as any)[field] = next;
        changed = true;
      }
    });
    if (changed) {
      try {
        await persistCompany(existing);
      } catch (err) {
        console.error('[db] Could not persist updated company to Postgres:', err);
      }
      updated++;
    } else {
      skipped++;
    }
  }

  res.json({ inserted, updated, skipped, errors, total: rows.length });
});

companiesRouter.put('/companies/:id', async (req, res) => {
  const user = getUser(req);
  if (!user || user.role !== UserRole.ADMIN) return res.status(403).json({ error: 'Forbidden' });

  const company = state.companies.find(c => c.id === req.params.id);
  if (!company) return res.status(404).json({ error: 'Company not found' });

  const { name, industry, notes } = req.body;
  if (name !== undefined) {
    if (!name.trim()) return res.status(400).json({ error: 'Company name is required.' });
    if (state.companies.some(c => c.id !== company.id && c.name.toLowerCase() === name.trim().toLowerCase())) {
      return res.status(400).json({ error: 'A company with this name already exists.' });
    }
    company.name = name.trim();
  }
  if (industry !== undefined) company.industry = industry;
  if (notes !== undefined) company.notes = notes;

  const enrichmentFields = ['address', 'business_unit_id', 'cost_center_id', 'default_department_id', 'currency', 'tax_id', 'default_approver_id', 'contact_person', 'contact_email'] as const;
  (['pending_review', ...enrichmentFields] as const)
    .forEach(field => {
      const value = req.body[field];
      if (value !== undefined && company[field] !== value) {
        addMasterDataHistory('companies', company.id, field, String(company[field] ?? '(none)'), String(value || '(none)'), user.id);
        (company as any)[field] = value;
      }
    });

  const editedSomethingElse = name !== undefined || industry !== undefined || notes !== undefined
    || enrichmentFields.some(field => req.body[field] !== undefined);
  if (editedSomethingElse && req.body.pending_review === undefined) {
    company.pending_review = false;
  }

  try {
    await persistCompany(company);
  } catch (err) {
    console.error('[db] Could not persist company changes to Postgres:', err);
  }

  res.json(company);
});
