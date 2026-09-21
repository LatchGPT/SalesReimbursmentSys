import { loadCashAdvanceLoopFromDb } from '../db/cashAdvanceRepo';
import { loadCoreLoopFromDb } from '../db/coreLoopRepo';
import {
  loadCompaniesFromDb,
  loadFieldDefinitionsFromDb,
  loadMasterDataHistoryFromDb,
  loadMasterDataTable,
  loadSystemSettingsFromDb,
} from '../db/referenceDataRepo';
import { isDbConfigured, loadUserHistoryFromDb, loadUsersFromDb } from '../db/usersRepo';
import {
  loadDelegationHistoryFromDb,
  loadDelegationsFromDb,
  loadReviewMeetingsFromDb,
  loadSupportRequestsFromDb,
} from '../db/workflowExtrasRepo';
import { serverEnv } from '../../../src/config/env';
import { config } from './config';
import { state } from './state';

let activeHydration: Promise<void> | undefined;

/**
 * Refreshes production state from PostgreSQL for a serverless request.
 *
 * The legacy controllers still operate on their existing state object during
 * Phase 2. Reloading it for every cold/warm request prevents a Vercel instance
 * from treating its process memory as the source of truth. Phase 3 will move
 * these reads into feature repositories so each handler requests only the rows
 * it needs.
 */
const globalForStateLoader = globalThis as typeof globalThis & {
  hasHydratedOnce?: boolean;
  dbConnectionFailed?: boolean;
};

export async function hydrateServerlessState(): Promise<void> {
  if (!isDbConfigured()) {
    if (!config.demoMode) {
      throw new Error('DATABASE_URL is required when DEMO_MODE=false');
    }
    return;
  }

  // In development (localhost), if database is unreachable (e.g. Wi-Fi blocks ports),
  // don't stall every subsequent request for 10 seconds.
  if (!serverEnv.isProduction && (globalForStateLoader.hasHydratedOnce || globalForStateLoader.dbConnectionFailed)) {
    return;
  }

  if (activeHydration) return activeHydration;

  activeHydration = (async () => {
    try {
      const [
        users,
        userHistory,
        core,
        advances,
        companies,
        departments,
        costCenters,
        businessUnits,
        branches,
        projectCodes,
        vendors,
        fieldDefinitions,
        systemSettings,
        masterDataHistory,
        delegations,
        delegationHistory,
        reviewMeetings,
        support,
      ] = await Promise.all([
        loadUsersFromDb(),
        loadUserHistoryFromDb(),
        loadCoreLoopFromDb(),
        loadCashAdvanceLoopFromDb(),
        loadCompaniesFromDb(),
        loadMasterDataTable('departments'),
        loadMasterDataTable('cost-centers'),
        loadMasterDataTable('business-units'),
        loadMasterDataTable('branches'),
        loadMasterDataTable('project-codes'),
        loadMasterDataTable('vendors'),
        loadFieldDefinitionsFromDb(),
        loadSystemSettingsFromDb(),
        loadMasterDataHistoryFromDb(),
        loadDelegationsFromDb(),
        loadDelegationHistoryFromDb(),
        loadReviewMeetingsFromDb(),
        loadSupportRequestsFromDb(),
      ]);

      if (users.length > 0) state.users = users;
      state.moms = core.moms;
      state.claims = core.claims;
      state.expenses = core.expenses;
      state.approvals = core.approvals;
      state.cashAdvances = advances.cashAdvances;
      state.liquidations = advances.liquidations;
      state.liquidationLineItems = advances.liquidationLineItems;
      if (companies.length > 0) state.companies = companies;
      if (departments.length > 0) state.departments = departments;
      if (costCenters.length > 0) state.costCenters = costCenters;
      if (businessUnits.length > 0) state.businessUnits = businessUnits;
      if (branches.length > 0) state.branches = branches;
      if (projectCodes.length > 0) state.projectCodes = projectCodes;
      if (vendors.length > 0) state.vendors = vendors;
      if (fieldDefinitions.length > 0) state.fieldDefinitions = fieldDefinitions;
      if (systemSettings) state.systemSettings = systemSettings;
      state.delegations = delegations;
      state.reviewMeetings = reviewMeetings;
      state.supportRequests = support.requests;
      state.supportMessages = support.messages;
      state.statusHistories = [
        ...userHistory,
        ...core.statusHistories,
        ...advances.statusHistories,
        ...masterDataHistory,
        ...delegationHistory,
      ];
    } catch (err) {
      console.error('[stateLoader] Could not hydrate state from PostgreSQL:', err);
      globalForStateLoader.dbConnectionFailed = true;
      if (!config.demoMode && serverEnv.isProduction) {
        throw err;
      }
    }
  })().finally(() => {
    globalForStateLoader.hasHydratedOnce = true;
    activeHydration = undefined;
  });

  return activeHydration;
}
