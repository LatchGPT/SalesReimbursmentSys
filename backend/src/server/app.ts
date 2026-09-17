import express from 'express';
import * as path from 'path';
import * as fs from 'fs';
import { config } from './config';
import { state } from './state';
import { httpLogger } from './middleware/logging';
import { configureSecurityMiddleware } from './middleware/security';
import { financeReadOnlyMiddleware } from './middleware/auth';
import { healthRouter } from './routes/health.routes';
import { uploadsRouter } from './routes/uploads.routes';
import { authRouter } from './routes/auth.routes';
import { companiesRouter } from './routes/companies.routes';
import { masterDataRouter } from './routes/masterData.routes';
import { fieldDefinitionsRouter } from './routes/fieldDefinitions.routes';
import { usersRouter } from './routes/users.routes';
import { momsRouter } from './routes/moms.routes';
import { expensesRouter } from './routes/expenses.routes';
import { claimsRouter } from './routes/claims.routes';
import { cashAdvancesRouter } from './routes/cashAdvances.routes';
import { liquidationsRouter } from './routes/liquidations.routes';
import { delegationsRouter } from './routes/delegations.routes';
import { reviewMeetingsRouter } from './routes/reviewMeetings.routes';
import { supportRouter } from './routes/support.routes';
import { activityRouter } from './routes/activity.routes';
import { analyticsRouter } from './routes/analytics.routes';
import { adminRouter } from './routes/admin.routes';
import { seedYearOfData } from './seed/seedYearOfData';
import { syncDelegationStatuses } from './services/delegations';
import { runStaleApproverFallbackCheck } from './services/hierarchy';
import {
  isDbConfigured, loadUsersFromDb, syncUsersToDb, loadUserHistoryFromDb
} from '../db/usersRepo';
import { loadCoreLoopFromDb } from '../db/coreLoopRepo';
import { loadCashAdvanceLoopFromDb } from '../db/cashAdvanceRepo';
import {
  loadCompaniesFromDb, loadMasterDataTable, loadFieldDefinitionsFromDb,
  loadSystemSettingsFromDb, loadMasterDataHistoryFromDb
} from '../db/referenceDataRepo';
import {
  loadDelegationsFromDb, loadDelegationHistoryFromDb,
  loadReviewMeetingsFromDb, loadSupportRequestsFromDb
} from '../db/workflowExtrasRepo';

export async function createApp() {
  const app = express();
  app.disable('x-powered-by');

  const demoModeEnabled = config.demoMode;

  // --- Users persistence bootstrap ---
  let usersLoadedFromDb = false;
  if (isDbConfigured()) {
    try {
      const dbUsers = await loadUsersFromDb();
      if (dbUsers.length > 0) {
        state.users.length = 0;
        state.users.push(...dbUsers);
        usersLoadedFromDb = true;
      } else if (demoModeEnabled && process.env.AUTO_SEED !== 'false') {
        await syncUsersToDb(state.users);
      } else {
        state.users.length = 0;
      }
    } catch (err) {
      console.error('[db] Could not load users from Postgres — falling back to the in-memory demo seed for this boot:', err);
    }
  } else if (!demoModeEnabled) {
    state.users.length = 0;
  }

  if (isDbConfigured()) {
    try {
      state.statusHistories.push(...(await loadUserHistoryFromDb()));
    } catch (err) {
      console.error('[db] Could not load user history from Postgres for this boot:', err);
    }
  }

  // --- Core loop persistence bootstrap ---
  if (isDbConfigured() && !demoModeEnabled) {
    try {
      const loaded = await loadCoreLoopFromDb();
      state.moms = loaded.moms;
      state.claims = loaded.claims;
      state.expenses = loaded.expenses;
      state.approvals = loaded.approvals;
      state.statusHistories.push(...loaded.statusHistories);
    } catch (err) {
      console.error('[db] Could not load the core reimbursement loop from Postgres for this boot:', err);
    }
    try {
      const loadedCa = await loadCashAdvanceLoopFromDb();
      state.cashAdvances = loadedCa.cashAdvances;
      state.liquidations = loadedCa.liquidations;
      state.liquidationLineItems = loadedCa.liquidationLineItems;
      state.statusHistories.push(...loadedCa.statusHistories);
    } catch (err) {
      console.error('[db] Could not load cash advances/liquidations from Postgres for this boot:', err);
    }
    try {
      state.companies = await loadCompaniesFromDb();
      state.departments = await loadMasterDataTable('departments');
      state.costCenters = await loadMasterDataTable('cost-centers');
      state.businessUnits = await loadMasterDataTable('business-units');
      state.branches = await loadMasterDataTable('branches');
      state.projectCodes = await loadMasterDataTable('project-codes');
      state.vendors = await loadMasterDataTable('vendors');
      state.fieldDefinitions = await loadFieldDefinitionsFromDb();
      const loadedSettings = await loadSystemSettingsFromDb();
      if (loadedSettings) state.systemSettings = loadedSettings;
      state.statusHistories.push(...(await loadMasterDataHistoryFromDb()));
      state.delegations = await loadDelegationsFromDb();
      state.statusHistories.push(...(await loadDelegationHistoryFromDb()));
      state.reviewMeetings = await loadReviewMeetingsFromDb();
      const loadedSupport = await loadSupportRequestsFromDb();
      state.supportRequests = loadedSupport.requests;
      state.supportMessages = loadedSupport.messages;
    } catch (err) {
      console.error('[db] Could not load reference data/delegations/support from Postgres for this boot:', err);
    }
  } else if (!demoModeEnabled) {
    state.companies = [];
    state.departments = [];
    state.costCenters = [];
    state.businessUnits = [];
    state.branches = [];
    state.projectCodes = [];
    state.vendors = [];
    state.fieldDefinitions = [];
  }

  // HTTP logger
  app.use(httpLogger);

  // Security middleware (Helmet, CORS, Rate Limiters)
  configureSecurityMiddleware(app);

  // JSON body parser
  app.use(express.json({ limit: '1mb' }));

  // Root unauthenticated/monitoring routes
  app.use(healthRouter);
  app.use(uploadsRouter);

  // Read-only middleware for finance role on mutative requests
  app.use('/api', financeReadOnlyMiddleware);

  // Mount API domain routers under /api
  app.use('/api', authRouter);
  app.use('/api', companiesRouter);
  app.use('/api', masterDataRouter);
  app.use('/api', fieldDefinitionsRouter);
  app.use('/api', usersRouter);
  app.use('/api', momsRouter);
  app.use('/api', expensesRouter);
  app.use('/api', claimsRouter);
  app.use('/api', cashAdvancesRouter);
  app.use('/api', liquidationsRouter);
  app.use('/api', delegationsRouter);
  app.use('/api', reviewMeetingsRouter);
  app.use('/api', supportRouter);
  app.use('/api', activityRouter);
  app.use('/api', analyticsRouter);
  app.use('/api', adminRouter);

  // Frontend: Vite dev middleware locally; static build in production.
  if (!config.isProduction && process.env.SERVE_FRONTEND !== 'false') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      configFile: path.join(config.projectRoot, 'frontend', 'vite.config.ts'),
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = config.distDir;
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('*', (_req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    }
  }

  // Auto-seed on startup unless explicitly disabled.
  if (demoModeEnabled && process.env.AUTO_SEED !== 'false') {
    try {
      state.suppressHistoryPersistence = true;
      try {
        await seedYearOfData(undefined, !usersLoadedFromDb);
      } finally {
        state.suppressHistoryPersistence = false;
      }
      console.log('Auto-seeded 1 year of mock data on startup.');
    } catch (err: any) {
      console.error('Failed to auto-seed mock data on startup:', err);
    }
  }

  // Scheduled background jobs
  if (process.env.VERCEL !== '1') {
    const SCHEDULED_JOB_INTERVAL_MS = 60 * 60 * 1000; // hourly
    setInterval(() => {
      syncDelegationStatuses();
      runStaleApproverFallbackCheck(false, 'system').catch((err: unknown) =>
        console.error('[scheduler] Stale-approver fallback check failed:', err));
    }, SCHEDULED_JOB_INTERVAL_MS);
  }

  return app;
}
