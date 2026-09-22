import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import {
  UserRole, MasterDataRecord, Department, CostCenter, BusinessUnit, Branch, ProjectCode, Vendor,
} from '../../lib/db/serverTypes';
import { state } from '../../server/state';
import { getUser } from '../../server/middleware/auth';
import { addMasterDataHistory } from '../../server/services/history';
import { persistMasterDataRecord, MasterDataKey } from '../../lib/db/referenceDataRepo';

export const masterDataRouter = Router();

interface MasterDataEntityConfig<T extends MasterDataRecord> {
  key: string;
  dbKey: MasterDataKey;
  label: string;
  store: () => T[];
  validateFields: (body: any, existing: T[], editingId?: string) => { errors: string[]; fields: Partial<T> };
}

const registerMasterDataRoutes = <T extends MasterDataRecord>(config: MasterDataEntityConfig<T>) => {
  const base = `/master-data/${config.key}`;

  masterDataRouter.get(base, (req, res) => {
    const user = getUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    res.json([...config.store()].sort((a, b) => a.name.localeCompare(b.name)));
  });

  masterDataRouter.post(base, async (req, res) => {
    const user = getUser(req);
    if (!user || user.role !== UserRole.ADMIN) return res.status(403).json({ error: 'Forbidden' });

    const { errors, fields } = config.validateFields(req.body, config.store());
    if (errors.length) return res.status(400).json({ error: errors[0] });

    const now = new Date().toISOString();
    const record = { id: uuidv4(), active: true, created_at: now, updated_at: now, ...fields } as T;
    config.store().push(record);
    try {
      await persistMasterDataRecord(config.dbKey, record);
    } catch (err) {
      console.error(`[db] Could not persist new ${config.label} to Postgres:`, err);
    }
    res.json(record);
  });

  masterDataRouter.put(`${base}/:id`, async (req, res) => {
    const user = getUser(req);
    if (!user || user.role !== UserRole.ADMIN) return res.status(403).json({ error: 'Forbidden' });

    const record = config.store().find(r => r.id === req.params.id);
    if (!record) return res.status(404).json({ error: `${config.label} not found` });

    const { errors, fields } = config.validateFields(req.body, config.store(), req.params.id);
    if (errors.length) return res.status(400).json({ error: errors[0] });

    (Object.entries(fields) as [keyof T, any][]).forEach(([field, value]) => {
      if (value !== undefined && record[field] !== value) {
        addMasterDataHistory(config.key, record.id, String(field), String(record[field]), String(value), user.id);
        record[field] = value;
      }
    });
    record.updated_at = new Date().toISOString();
    try {
      await persistMasterDataRecord(config.dbKey, record);
    } catch (err) {
      console.error(`[db] Could not persist ${config.label} changes to Postgres:`, err);
    }
    res.json(record);
  });
};

const validateNamedCatalogEntity = <T extends MasterDataRecord>(label: string) =>
  (body: any, existing: T[], editingId?: string): { errors: string[]; fields: Partial<T> } => {
    const errors: string[] = [];
    const fields: Partial<T> = {};
    if (body.name !== undefined) {
      const trimmed = String(body.name).trim();
      if (!trimmed) errors.push(`${label} name is required.`);
      else if (existing.some(r => r.id !== editingId && r.name.toLowerCase() === trimmed.toLowerCase())) {
        errors.push(`A ${label.toLowerCase()} with this name already exists.`);
      } else {
        (fields as any).name = trimmed;
      }
    }
    if (body.code !== undefined) (fields as any).code = body.code ? String(body.code).trim() : undefined;
    if (body.notes !== undefined) (fields as any).notes = body.notes;
    if (body.active !== undefined) (fields as any).active = !!body.active;
    return { errors, fields };
  };

registerMasterDataRoutes<Department>({
  key: 'departments', dbKey: 'departments', label: 'Department',
  store: () => state.departments,
  validateFields: validateNamedCatalogEntity('Department'),
});
registerMasterDataRoutes<CostCenter>({
  key: 'cost-centers', dbKey: 'cost-centers', label: 'Cost Center',
  store: () => state.costCenters,
  validateFields: validateNamedCatalogEntity('Cost Center'),
});
registerMasterDataRoutes<BusinessUnit>({
  key: 'business-units', dbKey: 'business-units', label: 'Business Unit',
  store: () => state.businessUnits,
  validateFields: validateNamedCatalogEntity('Business Unit'),
});
registerMasterDataRoutes<Branch>({
  key: 'branches', dbKey: 'branches', label: 'Branch',
  store: () => state.branches,
  validateFields: validateNamedCatalogEntity('Branch'),
});
registerMasterDataRoutes<ProjectCode>({
  key: 'project-codes', dbKey: 'project-codes', label: 'Project Code',
  store: () => state.projectCodes,
  validateFields: validateNamedCatalogEntity('Project Code'),
});
registerMasterDataRoutes<Vendor>({
  key: 'vendors', dbKey: 'vendors', label: 'Vendor',
  store: () => state.vendors,
  validateFields: validateNamedCatalogEntity('Vendor'),
});

masterDataRouter.get('/master-data/all', (req, res) => {
  const user = getUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  res.json({
    departments: [...state.departments].sort((a, b) => a.name.localeCompare(b.name)),
    costCenters: [...state.costCenters].sort((a, b) => a.name.localeCompare(b.name)),
    businessUnits: [...state.businessUnits].sort((a, b) => a.name.localeCompare(b.name)),
    branches: [...state.branches].sort((a, b) => a.name.localeCompare(b.name)),
    projectCodes: [...state.projectCodes].sort((a, b) => a.name.localeCompare(b.name)),
    vendors: [...state.vendors].sort((a, b) => a.name.localeCompare(b.name)),
  });
});
