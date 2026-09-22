import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { UserRole, FieldDefinition } from '../../lib/db/serverTypes';
import { state } from '../../server/state';
import { getUser } from '../../server/middleware/auth';
import { addMasterDataHistory } from '../../server/services/history';
import { persistFieldDefinition } from '../../lib/db/referenceDataRepo';

export const fieldDefinitionsRouter = Router();

const VALID_INPUT_TYPES = new Set(['text', 'number', 'dropdown', 'date', 'textarea']);
const VALID_MASTER_DATA_ENTITIES = new Set(['departments', 'costCenters', 'businessUnits', 'branches', 'projectCodes', 'vendors']);

export const validateFieldDefinitionBody = (body: any, existing: FieldDefinition[], editingId?: string): string | null => {
  if (body.key !== undefined) {
    const key = String(body.key).trim();
    if (!key) return 'Field key is required.';
    if (!/^[a-z][a-z0-9_]*$/.test(key)) return 'Field key must be lowercase letters, numbers, and underscores, starting with a letter.';
    if (existing.some(f => f.id !== editingId && f.entity === (body.entity || existing.find(e => e.id === editingId)?.entity) && f.key === key)) {
      return 'A field with this key already exists for this form.';
    }
  }
  if (body.label !== undefined && !String(body.label).trim()) return 'Field label is required.';
  if (body.input_type !== undefined && !VALID_INPUT_TYPES.has(body.input_type)) return `Input type must be one of: ${[...VALID_INPUT_TYPES].join(', ')}.`;
  if (body.master_data_entity !== undefined && body.master_data_entity !== null && !VALID_MASTER_DATA_ENTITIES.has(body.master_data_entity)) {
    return `Master data source must be one of: ${[...VALID_MASTER_DATA_ENTITIES].join(', ')}.`;
  }
  if (body.display_order !== undefined && typeof body.display_order !== 'number') return 'Display order must be a number.';
  return null;
};

export const validateRequiredCustomFields = (entity: FieldDefinition['entity'], customFields: Record<string, string> | undefined): string | null => {
  const missing = state.fieldDefinitions.find(f =>
    f.entity === entity && f.active && f.required && !(customFields && String(customFields[f.key] ?? '').trim())
  );
  if (missing) return `${missing.label} is required.`;

  const missingOther = state.fieldDefinitions.find(f =>
    f.entity === entity && f.active && f.allow_other &&
    customFields && String(customFields[f.key] ?? '').trim() === 'Other' &&
    !String(customFields[`${f.key}_other`] ?? '').trim()
  );
  if (missingOther) return `Please specify ${missingOther.label.toLowerCase()}.`;

  return null;
};

fieldDefinitionsRouter.get('/field-definitions', (req, res) => {
  const user = getUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  const entity = req.query.entity as string | undefined;
  const list = entity ? state.fieldDefinitions.filter(f => f.entity === entity) : state.fieldDefinitions;
  res.json([...list].sort((a, b) => a.display_order - b.display_order));
});

fieldDefinitionsRouter.post('/field-definitions', async (req, res) => {
  const user = getUser(req);
  if (!user || user.role !== UserRole.ADMIN) return res.status(403).json({ error: 'Forbidden' });

  if (!req.body.key || !req.body.label || !req.body.input_type || !req.body.entity) {
    return res.status(400).json({ error: 'entity, key, label, and input_type are required.' });
  }
  const validationError = validateFieldDefinitionBody(req.body, state.fieldDefinitions);
  if (validationError) return res.status(400).json({ error: validationError });

  const now = new Date().toISOString();
  const def: FieldDefinition = {
    id: uuidv4(),
    entity: req.body.entity,
    key: String(req.body.key).trim(),
    label: String(req.body.label).trim(),
    input_type: req.body.input_type,
    required: !!req.body.required,
    active: req.body.active !== undefined ? !!req.body.active : true,
    default_value: req.body.default_value || undefined,
    display_order: typeof req.body.display_order === 'number' ? req.body.display_order : state.fieldDefinitions.length + 1,
    options: Array.isArray(req.body.options) ? req.body.options : undefined,
    master_data_entity: req.body.master_data_entity || undefined,
    allow_other: !!req.body.allow_other,
    applicableClaimTypes: Array.isArray(req.body.applicableClaimTypes) ? req.body.applicableClaimTypes : undefined,
    validation: req.body.validation || undefined,
    created_at: now,
    updated_at: now,
  };
  state.fieldDefinitions.push(def);
  try {
    await persistFieldDefinition(def);
  } catch (err) {
    console.error('[db] Could not persist new field definition to Postgres:', err);
  }
  res.json(def);
});

fieldDefinitionsRouter.put('/field-definitions/:id', async (req, res) => {
  const user = getUser(req);
  if (!user || user.role !== UserRole.ADMIN) return res.status(403).json({ error: 'Forbidden' });

  const def = state.fieldDefinitions.find(f => f.id === req.params.id);
  if (!def) return res.status(404).json({ error: 'Field definition not found' });

  const validationError = validateFieldDefinitionBody(req.body, state.fieldDefinitions, def.id);
  if (validationError) return res.status(400).json({ error: validationError });

  (['key', 'label', 'input_type', 'required', 'active', 'default_value', 'display_order', 'options', 'master_data_entity', 'allow_other', 'applicableClaimTypes', 'validation'] as const)
    .forEach(field => {
      const value = req.body[field];
      if (value !== undefined && JSON.stringify((def as any)[field]) !== JSON.stringify(value)) {
        addMasterDataHistory('field-definitions', def.id, field, JSON.stringify((def as any)[field] ?? null), JSON.stringify(value), user.id);
        (def as any)[field] = value;
      }
    });
  def.updated_at = new Date().toISOString();
  try {
    await persistFieldDefinition(def);
  } catch (err) {
    console.error('[db] Could not persist field definition changes to Postgres:', err);
  }
  res.json(def);
});
