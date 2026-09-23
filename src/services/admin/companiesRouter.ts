import { v4 as uuidv4 } from 'uuid';
import { UserRole, type Company } from '../../lib/db/serverTypes';
import { persistCompany } from '../../lib/db/referenceDataRepo';
import { state } from '../../server/state';
import { addMasterDataHistory } from '../../server/services/history';
type ErrorBody = { error: string }; type Result<T> = { status: number; body: T };
function userFor(id: string | null) { return state.users.find((user) => user.id === id || user.entra_object_id === id || user.user_principal_name === id); }
function admin(id: string | null) { const user = userFor(id); return user?.role === UserRole.ADMIN ? user : undefined; }
const fields = ['address', 'business_unit_id', 'cost_center_id', 'default_department_id', 'currency', 'tax_id', 'default_approver_id', 'contact_person', 'contact_email'] as const;
export function listCompanies(userId: string | null): Result<Company[] | ErrorBody> { return userFor(userId) ? { status: 200, body: [...state.companies].sort((a, b) => a.name.localeCompare(b.name)) } : { status: 401, body: { error: 'Unauthorized' } }; }
export async function createCompany(userId: string | null, body: Record<string, unknown>): Promise<Result<Company | ErrorBody>> {
  const user = admin(userId); if (!user) return { status: 403, body: { error: 'Forbidden' } }; const name = String(body.name || '').trim();
  if (!name) return { status: 400, body: { error: 'Company name is required.' } }; if (state.companies.some((company) => company.name.toLowerCase() === name.toLowerCase())) return { status: 400, body: { error: 'A company with this name already exists.' } };
  const company: Company = { id: uuidv4(), name, industry: body.industry as string, notes: body.notes as string, pending_review: false, created_by: user.id };
  fields.forEach((field) => { if (body[field] !== undefined) (company as unknown as Record<string, unknown>)[field] = body[field]; }); state.companies.push(company);
  try { await persistCompany(company); } catch (error) { console.error('[db] Could not persist new company to Postgres:', error); } return { status: 200, body: company };
}
export async function importCompanies(userId: string | null, body: Record<string, unknown>): Promise<Result<{ inserted: number; updated: number; skipped: number; errors: Array<{ row: number; error: string }>; total: number } | ErrorBody>> {
  const user = admin(userId); if (!user) return { status: 403, body: { error: 'Forbidden' } }; const rows = Array.isArray(body.companies) ? body.companies as Array<Record<string, unknown>> : [];
  if (!rows.length) return { status: 400, body: { error: 'The import contains no company rows.' } }; if (rows.length > 5000) return { status: 400, body: { error: 'A single import is limited to 5,000 companies.' } };
  let inserted = 0; let updated = 0; let skipped = 0; const errors: Array<{ row: number; error: string }> = [];
  for (const [index, raw] of rows.entries()) { const name = String(raw.name || '').trim(); if (!name) { errors.push({ row: index + 2, error: 'Company name is required.' }); continue; }
    const values = Object.fromEntries(['industry', 'notes', 'currency', 'tax_id', 'contact_person', 'contact_email'].map((field) => [field, String(raw[field] || raw[field.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase())] || '').trim() || undefined])); values.address = String(raw.address || raw.location || '').trim() || undefined;
    const company = state.companies.find((entry) => entry.name.toLowerCase() === name.toLowerCase()); if (!company) { const created: Company = { id: uuidv4(), name, ...values }; state.companies.push(created); addMasterDataHistory('companies', created.id, 'import', '(new)', name, user.id); try { await persistCompany(created); } catch (error) { console.error('[db] Could not persist imported company to Postgres:', error); } inserted++; continue; }
    let changed = false; Object.entries(values).forEach(([field, value]) => { if (value !== undefined && (company as unknown as Record<string, unknown>)[field] !== value) { addMasterDataHistory('companies', company.id, field, String((company as unknown as Record<string, unknown>)[field] ?? '(none)'), value as string, user.id); (company as unknown as Record<string, unknown>)[field] = value; changed = true; } }); if (changed) { try { await persistCompany(company); } catch (error) { console.error('[db] Could not persist updated company to Postgres:', error); } updated++; } else skipped++;
  } return { status: 200, body: { inserted, updated, skipped, errors, total: rows.length } };
}
export async function updateCompany(userId: string | null, id: string, body: Record<string, unknown>): Promise<Result<Company | ErrorBody>> {
  if (!admin(userId)) return { status: 403, body: { error: 'Forbidden' } }; const company = state.companies.find((entry) => entry.id === id); if (!company) return { status: 404, body: { error: 'Company not found' } };
  if (body.name !== undefined) { const name = String(body.name).trim(); if (!name) return { status: 400, body: { error: 'Company name is required.' } }; if (state.companies.some((entry) => entry.id !== id && entry.name.toLowerCase() === name.toLowerCase())) return { status: 400, body: { error: 'A company with this name already exists.' } }; company.name = name; }
  if (body.industry !== undefined) company.industry = body.industry as string; if (body.notes !== undefined) company.notes = body.notes as string;
  (['pending_review', ...fields] as const).forEach((field) => { const value = body[field]; if (value !== undefined && company[field] !== value) { addMasterDataHistory('companies', company.id, field, String(company[field] ?? '(none)'), String(value || '(none)'), userId!); (company as unknown as Record<string, unknown>)[field] = value; } });
  if ((body.name !== undefined || body.industry !== undefined || body.notes !== undefined || fields.some((field) => body[field] !== undefined)) && body.pending_review === undefined) company.pending_review = false;
  try { await persistCompany(company); } catch (error) { console.error('[db] Could not persist company changes to Postgres:', error); } return { status: 200, body: company };
}
