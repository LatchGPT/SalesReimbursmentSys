import { v4 as uuidv4 } from 'uuid';
import { Company } from '../../lib/db/serverTypes';
import { state } from '../state';
import { persistCompany } from '../../lib/db/referenceDataRepo';

export function getOrCreateCompanyInMemory(name?: string | null): void {
  if (!name || !name.trim()) return;
  const trimmed = name.trim();
  const exists = state.companies.some(c => c.name.toLowerCase() === trimmed.toLowerCase());
  if (!exists) {
    state.companies.push({ id: uuidv4(), name: trimmed });
  }
}

export async function getOrCreateCompany(name?: string | null, createdByUserId?: string): Promise<void> {
  if (!name || !name.trim()) return;
  const trimmed = name.trim();
  const exists = state.companies.some(c => c.name.toLowerCase() === trimmed.toLowerCase());
  if (exists) return;
  const created: Company = { id: uuidv4(), name: trimmed, pending_review: true, created_by: createdByUserId };
  state.companies.push(created);
  try {
    await persistCompany(created);
  } catch (err) {
    console.error('[db] Could not persist new company to Postgres:', err);
  }
}
