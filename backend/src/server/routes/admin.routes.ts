import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import {
  UserRole, ImportBatch, Claim, ExpenseLineItem, StatusHistory, ClaimStatus
} from '../../serverTypes';
import {
  state, buildDefaultUsers, applyHierarchySyncDefaults,
  buildInitialCompanies, buildInitialDepartments, buildInitialCostCenters,
  buildInitialBusinessUnits, buildInitialBranches, buildInitialProjectCodes,
  buildInitialVendors, buildInitialFieldDefinitions
} from '../state';
import { config } from '../config';
import { getUser } from '../middleware/auth';
import { normalizeExpenseCategory } from '../../lib/expenseCategories';
import { generateClaimNumber } from '../services/claimNumber';
import { runStaleApproverFallbackCheck } from '../services/hierarchy';
import { seedYearOfData, SeedDataOptions } from '../seed/seedYearOfData';
import {
  persistSystemSettings, persistCompany, persistMasterDataRecord,
  persistFieldDefinition, clearReferenceDataInDb
} from '../../db/referenceDataRepo';
import { clearUsersInDb, syncUsersToDb, isDbConfigured } from '../../db/usersRepo';
import { clearCoreLoopInDb, syncClaimNumberSequenceFloor, persistHistoricalImportBatch } from '../../db/coreLoopRepo';
import { clearCashAdvanceLoopInDb } from '../../db/cashAdvanceRepo';
import { clearWorkflowExtrasInDb } from '../../db/workflowExtrasRepo';

export const adminRouter = Router();

// Admin settings endpoints
adminRouter.get('/admin/settings', (req, res) => {
  const user = getUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  res.json(state.systemSettings);
});

adminRouter.put('/admin/settings', async (req, res) => {
  const user = getUser(req);
  if (!user || user.role !== UserRole.ADMIN) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const { expenseCategories, highValueThreshold, paymentMethods, categoryLimits } = req.body;
  if (expenseCategories && Array.isArray(expenseCategories)) {
    state.systemSettings.expenseCategories = Array.from(new Set(expenseCategories.map(normalizeExpenseCategory).filter(Boolean)));
  }
  if (typeof highValueThreshold === 'number') {
    state.systemSettings.highValueThreshold = highValueThreshold;
  }
  if (paymentMethods && Array.isArray(paymentMethods)) {
    state.systemSettings.paymentMethods = paymentMethods;
  }
  if (categoryLimits && typeof categoryLimits === 'object' && !Array.isArray(categoryLimits)) {
    const cleaned: Record<string, number> = {};
    for (const [cat, val] of Object.entries(categoryLimits)) {
      const num = Number(val);
      if (Number.isFinite(num) && num > 0) cleaned[normalizeExpenseCategory(cat)] = num;
    }
    state.systemSettings.categoryLimits = cleaned;
  }
  try {
    await persistSystemSettings(state.systemSettings);
  } catch (err) {
    console.error('[db] Could not persist system settings to Postgres:', err);
  }
  res.json(state.systemSettings);
});

adminRouter.post('/admin/run-fallback-check', async (req, res) => {
  const admin = getUser(req);
  if (!admin || admin.role !== UserRole.ADMIN) return res.status(403).json({ error: 'Forbidden' });

  const force = !!req.body?.force;
  const escalated = await runStaleApproverFallbackCheck(force, admin.id);
  res.json({ escalatedCount: escalated.length, escalated: escalated.map(c => c.id) });
});

// Admin: Seed Data
adminRouter.post('/admin/seed', async (req, res) => {
  if (!config.demoMode) return res.status(404).json({ error: 'Demo data tools are disabled.' });
  const user = getUser(req);
  if (!user || user.role !== UserRole.ADMIN) return res.status(403).json({ error: 'Forbidden' });

  try {
    state.suppressHistoryPersistence = true;
    try {
      await seedYearOfData({
        demoClaims: true,
        demoCashAdvances: true,
        delegations: true,
        historicalBackfill: false,
        reviewMeetings: false,
        supportRequests: false,
      });
    } finally {
      state.suppressHistoryPersistence = false;
    }
    res.json({ success: true });
  } catch (err: any) {
    console.error('Failed to seed mock data:', err);
    res.status(500).json({ error: err.message });
  }
});

// Admin: Seed 1 Year of History
adminRouter.post('/admin/seed-year', async (req, res) => {
  if (!config.demoMode) return res.status(404).json({ error: 'Demo data tools are disabled.' });
  const user = getUser(req);
  if (!user || user.role !== UserRole.ADMIN) return res.status(403).json({ error: 'Forbidden' });

  try {
    const requestedOptions = req.body && req.body.options;
    state.suppressHistoryPersistence = true;
    try {
      if (requestedOptions && typeof requestedOptions === 'object') {
        const selective: SeedDataOptions = {
          demoClaims: !!requestedOptions.demoClaims,
          demoCashAdvances: !!requestedOptions.demoCashAdvances,
          delegations: !!requestedOptions.delegations,
          historicalBackfill: !!requestedOptions.historicalBackfill,
          reviewMeetings: !!requestedOptions.reviewMeetings,
          supportRequests: !!requestedOptions.supportRequests,
        };
        await seedYearOfData(selective);
      } else {
        await seedYearOfData();
      }
    } finally {
      state.suppressHistoryPersistence = false;
    }
    res.json({ success: true });
  } catch (err: any) {
    console.error('Failed to manually seed:', err);
    res.status(500).json({ error: err.message });
  }
});

// Admin: Reset Simulation
adminRouter.post('/admin/reset', async (req, res) => {
  if (!config.demoMode) return res.status(404).json({ error: 'Demo data tools are disabled.' });
  const user = getUser(req);
  if (!user || user.role !== UserRole.ADMIN) return res.status(403).json({ error: 'Forbidden' });

  state.moms = [];
  state.claims = [];
  state.expenses = [];
  state.approvals = [];
  state.statusHistories = [];
  state.emails = [];
  state.teamsMessages = [];
  state.lastSeenStore = {};
  state.cashAdvances = [];
  state.liquidations = [];
  state.liquidationLineItems = [];
  state.reviewMeetings = [];
  state.delegations = [];
  state.supportRequests = [];
  state.supportMessages = [];
  state.companies = buildInitialCompanies();
  state.departments = buildInitialDepartments();
  state.costCenters = buildInitialCostCenters();
  state.businessUnits = buildInitialBusinessUnits();
  state.branches = buildInitialBranches();
  state.projectCodes = buildInitialProjectCodes();
  state.vendors = buildInitialVendors();
  state.fieldDefinitions = buildInitialFieldDefinitions();

  state.users.length = 0;
  state.users.push(...buildDefaultUsers());
  applyHierarchySyncDefaults(state.users);
  try {
    await clearUsersInDb();
    await syncUsersToDb(state.users);
    await clearCoreLoopInDb();
    await clearCashAdvanceLoopInDb();
    await clearWorkflowExtrasInDb();
    await clearReferenceDataInDb();
    for (const company of state.companies) await persistCompany(company);
    for (const dept of state.departments) await persistMasterDataRecord('departments', dept);
    for (const cc of state.costCenters) await persistMasterDataRecord('cost-centers', cc);
    for (const bu of state.businessUnits) await persistMasterDataRecord('business-units', bu);
    for (const branch of state.branches) await persistMasterDataRecord('branches', branch);
    for (const pc of state.projectCodes) await persistMasterDataRecord('project-codes', pc);
    for (const vendor of state.vendors) await persistMasterDataRecord('vendors', vendor);
    for (const field of state.fieldDefinitions) await persistFieldDefinition(field);
    await syncClaimNumberSequenceFloor(123);
  } catch (err) {
    console.error('[db] Could not persist reset state to Postgres:', err);
  }

  state.claimCounter = 123;

  res.json({ success: true });
});

adminRouter.get('/imports', (req, res) => {
  const user = getUser(req);
  if (!user || user.role !== UserRole.ADMIN) return res.status(403).json({ error: 'Forbidden' });
  res.json(state.importBatches);
});

adminRouter.post('/imports', async (req, res) => {
  const user = getUser(req);
  if (!user || user.role !== UserRole.ADMIN) return res.status(403).json({ error: 'Forbidden' });

  const { filename, records } = req.body;
  if (!Array.isArray(records) || records.length === 0) {
    return res.status(400).json({ error: 'No valid records provided' });
  }

  const batchId = uuidv4();
  const newBatch: ImportBatch = {
    id: batchId,
    admin_id: user.id,
    filename,
    total_records: records.length,
    imported_at: new Date().toISOString()
  };

  const claimsToCreate: Claim[] = [];
  const expensesToCreate: ExpenseLineItem[] = [];
  const historyToCreate: StatusHistory[] = [];

  for (const record of records) {
    const claimId = uuidv4();
    const claimNumber = record.claim_number || (await generateClaimNumber());

    claimsToCreate.push({
      id: claimId,
      claim_number: claimNumber,
      requestor_id: record.requestor_id,
      current_approver_id: user.id,
      mom_id: record.mom_id || '',
      status: ClaimStatus.COMPLETED,
      total_amount: record.total_amount,
      expense_category: normalizeExpenseCategory(record.expense_category),
      receipt_url: record.receipt_url || '',
      remarks: record.remarks || '',
      import_batch_id: batchId,
      created_at: record.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString()
    });

    if (record.lineItems && Array.isArray(record.lineItems)) {
      for (const li of record.lineItems) {
        expensesToCreate.push({
          id: uuidv4(),
          claim_id: claimId,
          expense_date: li.expense_date || new Date().toISOString().split('T')[0],
          vendor: li.vendor || 'Unknown',
          category: normalizeExpenseCategory(li.category || 'Other'),
          amount: li.amount || 0,
          payment_method: li.payment_method || 'Corporate Card',
          business_purpose: li.business_purpose || 'Historical data import',
          receipt_url: li.receipt_url || '',
          or_number: li.or_number || ''
        });
      }
    }

    historyToCreate.push({
      id: uuidv4(),
      claim_id: claimId,
      old_status: 'Imported',
      new_status: ClaimStatus.COMPLETED,
      changed_by: user.id,
      reason: `Migrated from historical records by ${user.name} (Batch ${batchId.substring(0,6)})`,
      timestamp: new Date().toISOString()
    });
  }

  if (isDbConfigured()) {
    try {
      await persistHistoricalImportBatch(newBatch, claimsToCreate, expensesToCreate, historyToCreate);
    } catch (err) {
      console.error('[db] Historical import batch failed, rejecting whole batch:', err);
      return res.status(500).json({ error: 'Import failed while saving records. No records from this batch were imported — check for duplicate claim numbers and try again.' });
    }
  }

  state.importBatches.push(newBatch);
  state.claims.push(...claimsToCreate);
  state.expenses.push(...expensesToCreate);
  state.statusHistories.push(...historyToCreate);

  res.status(201).json(newBatch);
});
