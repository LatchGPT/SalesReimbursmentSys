import type {
  companies as CompanyRow,
  field_definitions as FieldDefinitionRow,
  status_histories as StatusHistoryRow,
} from '../generated/prisma/client';
import type {
  Company,
  FieldDefinition,
  MasterDataRecord,
  StatusHistory,
} from '../serverTypes';
import { getDb, type Db } from './index';

export const isDbConfigured = () => !!process.env.DATABASE_URL;

function companyToRow(company: Company) {
  return {
    id: company.id,
    name: company.name,
    industry: company.industry ?? null,
    notes: company.notes ?? null,
    address: company.address ?? null,
    business_unit_id: company.business_unit_id || null,
    cost_center_id: company.cost_center_id || null,
    default_department_id: company.default_department_id || null,
    currency: company.currency ?? null,
    tax_id: company.tax_id ?? null,
    contact_person: company.contact_person ?? null,
    contact_email: company.contact_email ?? null,
    default_approver_id: company.default_approver_id || null,
    pending_review: company.pending_review ?? false,
    created_by: company.created_by || null,
  };
}

function companyFromRow(row: CompanyRow): Company {
  return {
    id: row.id,
    name: row.name,
    industry: row.industry ?? undefined,
    notes: row.notes ?? undefined,
    address: row.address ?? undefined,
    business_unit_id: row.business_unit_id ?? undefined,
    cost_center_id: row.cost_center_id ?? undefined,
    default_department_id: row.default_department_id ?? undefined,
    currency: row.currency ?? undefined,
    tax_id: row.tax_id ?? undefined,
    contact_person: row.contact_person ?? undefined,
    contact_email: row.contact_email ?? undefined,
    default_approver_id: row.default_approver_id ?? undefined,
    pending_review: row.pending_review,
    created_by: row.created_by ?? undefined,
  };
}

export async function persistCompany(company: Company): Promise<void> {
  if (!isDbConfigured()) return;
  const row = companyToRow(company);
  await getDb().companies.upsert({
    where: { id: row.id },
    create: row,
    update: row,
  });
}

export async function loadCompaniesFromDb(): Promise<Company[]> {
  if (!isDbConfigured()) return [];
  return (await getDb().companies.findMany()).map(companyFromRow);
}

export type MasterDataKey =
  | 'departments'
  | 'cost-centers'
  | 'business-units'
  | 'branches'
  | 'project-codes'
  | 'vendors';

function masterDataToRow(record: MasterDataRecord) {
  return {
    id: record.id,
    name: record.name,
    code: record.code ?? null,
    active: record.active,
    notes: record.notes ?? null,
  };
}

type MasterDataRow = ReturnType<typeof masterDataToRow> & {
  created_at: Date;
  updated_at: Date;
};

function masterDataFromRow<T extends MasterDataRecord>(row: MasterDataRow): T {
  return {
    id: row.id,
    name: row.name,
    code: row.code ?? undefined,
    active: row.active,
    notes: row.notes ?? undefined,
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
  } as T;
}

async function upsertMasterData(
  db: Db,
  key: MasterDataKey,
  row: ReturnType<typeof masterDataToRow>,
) {
  const operation = { where: { id: row.id }, create: row, update: row };
  switch (key) {
    case 'departments': return db.departments.upsert(operation);
    case 'cost-centers': return db.cost_centers.upsert(operation);
    case 'business-units': return db.business_units.upsert(operation);
    case 'branches': return db.branches.upsert(operation);
    case 'project-codes': return db.project_codes.upsert(operation);
    case 'vendors': return db.vendors.upsert(operation);
  }
}

async function findMasterData(db: Db, key: MasterDataKey): Promise<MasterDataRow[]> {
  switch (key) {
    case 'departments': return db.departments.findMany();
    case 'cost-centers': return db.cost_centers.findMany();
    case 'business-units': return db.business_units.findMany();
    case 'branches': return db.branches.findMany();
    case 'project-codes': return db.project_codes.findMany();
    case 'vendors': return db.vendors.findMany();
  }
}

export async function persistMasterDataRecord(
  key: MasterDataKey,
  record: MasterDataRecord,
): Promise<void> {
  if (!isDbConfigured()) return;
  await upsertMasterData(getDb(), key, masterDataToRow(record));
}

export async function loadMasterDataTable<T extends MasterDataRecord>(
  key: MasterDataKey,
): Promise<T[]> {
  if (!isDbConfigured()) return [];
  return (await findMasterData(getDb(), key)).map(masterDataFromRow<T>);
}

function fieldDefinitionToRow(field: FieldDefinition) {
  return {
    id: field.id,
    entity: field.entity,
    // Prisma scalar lists cannot represent SQL NULL. Normalize future writes
    // to empty arrays while retaining equivalent application semantics.
    applicable_claim_types: field.applicableClaimTypes ?? [],
    key: field.key,
    label: field.label,
    input_type: field.input_type,
    required: field.required,
    active: field.active,
    default_value: field.default_value ?? null,
    display_order: field.display_order,
    options: field.options ?? [],
    master_data_entity: field.master_data_entity ?? null,
    allow_other: field.allow_other ?? false,
    validation: field.validation ? JSON.stringify(field.validation) : null,
  };
}

function fieldDefinitionFromRow(row: FieldDefinitionRow): FieldDefinition {
  return {
    id: row.id,
    entity: row.entity,
    applicableClaimTypes: (row.applicable_claim_types ?? undefined) as
      FieldDefinition['applicableClaimTypes'],
    key: row.key,
    label: row.label,
    input_type: row.input_type,
    required: row.required,
    active: row.active,
    default_value: row.default_value ?? undefined,
    display_order: row.display_order,
    options: row.options ?? undefined,
    master_data_entity: (row.master_data_entity ?? undefined) as
      FieldDefinition['master_data_entity'],
    allow_other: row.allow_other ?? undefined,
    validation: row.validation ? JSON.parse(row.validation) : undefined,
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
  };
}

export async function persistFieldDefinition(field: FieldDefinition): Promise<void> {
  if (!isDbConfigured()) return;
  const row = fieldDefinitionToRow(field);
  await getDb().field_definitions.upsert({
    where: { id: row.id },
    create: row,
    update: row,
  });
}

export async function loadFieldDefinitionsFromDb(): Promise<FieldDefinition[]> {
  if (!isDbConfigured()) return [];
  return (await getDb().field_definitions.findMany()).map(fieldDefinitionFromRow);
}

export interface SystemSettingsShape {
  expenseCategories: string[];
  highValueThreshold: number;
  paymentMethods: string[];
  categoryLimits: Record<string, number>;
}

export async function persistSystemSettings(
  settings: SystemSettingsShape,
): Promise<void> {
  if (!isDbConfigured()) return;
  const row = {
    id: 'default',
    expense_categories: settings.expenseCategories,
    high_value_threshold: settings.highValueThreshold,
    payment_methods: settings.paymentMethods,
    category_limits: JSON.stringify(settings.categoryLimits || {}),
  };
  await getDb().system_settings.upsert({
    where: { id: row.id },
    create: row,
    update: row,
  });
}

export async function clearReferenceDataInDb(): Promise<void> {
  if (!isDbConfigured()) return;
  await getDb().$transaction(async (tx) => {
    await tx.companies.deleteMany();
    await tx.departments.deleteMany();
    await tx.cost_centers.deleteMany();
    await tx.business_units.deleteMany();
    await tx.branches.deleteMany();
    await tx.project_codes.deleteMany();
    await tx.vendors.deleteMany();
    await tx.field_definitions.deleteMany();
  });
}

export async function loadSystemSettingsFromDb():
Promise<SystemSettingsShape | undefined> {
  if (!isDbConfigured()) return undefined;
  const row = await getDb().system_settings.findUnique({ where: { id: 'default' } });
  if (!row) return undefined;
  return {
    expenseCategories: row.expense_categories,
    highValueThreshold: Number(row.high_value_threshold),
    paymentMethods: row.payment_methods,
    categoryLimits: row.category_limits ? JSON.parse(row.category_limits) : {},
  };
}

function masterDataHistoryFromRow(row: StatusHistoryRow): StatusHistory {
  return {
    id: row.id,
    claim_id: '',
    master_data_key: row.master_data_key ?? undefined,
    master_data_id: row.master_data_id ?? undefined,
    old_status: row.old_status,
    new_status: row.new_status,
    changed_by: row.changed_by,
    reason: row.reason ?? undefined,
    timestamp: row.timestamp.toISOString(),
  };
}

export async function loadMasterDataHistoryFromDb(): Promise<StatusHistory[]> {
  if (!isDbConfigured()) return [];
  const rows = await getDb().status_histories.findMany({
    where: {
      master_data_key: { not: null },
      master_data_id: { not: null },
    },
  });
  return rows.map(masterDataHistoryFromRow);
}
