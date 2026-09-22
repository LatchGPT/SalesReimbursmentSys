import { v4 as uuidv4 } from 'uuid';
import { UserRole, type MasterDataRecord } from '../../lib/db/serverTypes';
import { persistMasterDataRecord, type MasterDataKey } from '../../lib/db/referenceDataRepo';
import { state } from '../../server/state';
import { addMasterDataHistory } from '../../server/services/history';

type ErrorBody = { error: string };
type Result<T> = { status: number; body: T };
type Catalog = { key: MasterDataKey; label: string; store: () => MasterDataRecord[] };

const catalogs: Record<string, Catalog> = {
  departments: { key: 'departments', label: 'Department', store: () => state.departments },
  'cost-centers': { key: 'cost-centers', label: 'Cost Center', store: () => state.costCenters },
  'business-units': { key: 'business-units', label: 'Business Unit', store: () => state.businessUnits },
  branches: { key: 'branches', label: 'Branch', store: () => state.branches },
  'project-codes': { key: 'project-codes', label: 'Project Code', store: () => state.projectCodes },
  vendors: { key: 'vendors', label: 'Vendor', store: () => state.vendors },
};

function userFor(userId: string | null) { return state.users.find((user) => user.id === userId || user.entra_object_id === userId || user.user_principal_name === userId); }
function catalogFor(entity: string) { return catalogs[entity]; }
function validate(body: Record<string, unknown>, catalog: Catalog, editingId?: string) {
  const fields: Partial<MasterDataRecord> = {};
  if (body.name !== undefined) {
    const name = String(body.name).trim();
    if (!name) return { error: `${catalog.label} name is required.` };
    if (catalog.store().some((record) => record.id !== editingId && record.name.toLowerCase() === name.toLowerCase())) return { error: `A ${catalog.label.toLowerCase()} with this name already exists.` };
    fields.name = name;
  }
  if (body.code !== undefined) fields.code = body.code ? String(body.code).trim() : undefined;
  if (body.notes !== undefined) fields.notes = body.notes ? String(body.notes) : undefined;
  if (body.active !== undefined) fields.active = !!body.active;
  return { fields };
}
function sorted(records: MasterDataRecord[]) { return [...records].sort((left, right) => left.name.localeCompare(right.name)); }

export function listMasterData(userId: string | null, entity: string): Result<MasterDataRecord[] | ErrorBody> {
  if (!userFor(userId)) return { status: 401, body: { error: 'Unauthorized' } };
  const catalog = catalogFor(entity);
  return catalog ? { status: 200, body: sorted(catalog.store()) } : { status: 404, body: { error: 'Not found' } };
}
export function listAllMasterData(userId: string | null): Result<Record<string, MasterDataRecord[]> | ErrorBody> {
  if (!userFor(userId)) return { status: 401, body: { error: 'Unauthorized' } };
  return { status: 200, body: { departments: sorted(state.departments), costCenters: sorted(state.costCenters), businessUnits: sorted(state.businessUnits), branches: sorted(state.branches), projectCodes: sorted(state.projectCodes), vendors: sorted(state.vendors) } };
}
export async function createMasterData(userId: string | null, entity: string, body: Record<string, unknown>): Promise<Result<MasterDataRecord | ErrorBody>> {
  const user = userFor(userId); const catalog = catalogFor(entity);
  if (!user || user.role !== UserRole.ADMIN) return { status: 403, body: { error: 'Forbidden' } };
  if (!catalog) return { status: 404, body: { error: 'Not found' } };
  const result = validate(body, catalog); if ('error' in result) return { status: 400, body: { error: result.error! } };
  const now = new Date().toISOString(); const record: MasterDataRecord = { id: uuidv4(), active: true, created_at: now, updated_at: now, ...result.fields } as MasterDataRecord;
  catalog.store().push(record);
  try { await persistMasterDataRecord(catalog.key, record); } catch (error) { console.error(`[db] Could not persist new ${catalog.label} to Postgres:`, error); }
  return { status: 200, body: record };
}
export async function updateMasterData(userId: string | null, entity: string, id: string, body: Record<string, unknown>): Promise<Result<MasterDataRecord | ErrorBody>> {
  const user = userFor(userId); const catalog = catalogFor(entity);
  if (!user || user.role !== UserRole.ADMIN) return { status: 403, body: { error: 'Forbidden' } };
  if (!catalog) return { status: 404, body: { error: 'Not found' } };
  const record = catalog.store().find((entry) => entry.id === id); if (!record) return { status: 404, body: { error: `${catalog.label} not found` } };
  const result = validate(body, catalog, id); if ('error' in result) return { status: 400, body: { error: result.error! } };
  Object.entries(result.fields).forEach(([field, value]) => { if (value !== undefined && record[field as keyof MasterDataRecord] !== value) { addMasterDataHistory(entity, record.id, field, String(record[field as keyof MasterDataRecord]), String(value), user.id); (record as unknown as Record<string, unknown>)[field] = value; } });
  record.updated_at = new Date().toISOString();
  try { await persistMasterDataRecord(catalog.key, record); } catch (error) { console.error(`[db] Could not persist ${catalog.label} changes to Postgres:`, error); }
  return { status: 200, body: record };
}
