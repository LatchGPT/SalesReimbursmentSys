import { Router } from 'express';
import { sql } from 'drizzle-orm';
import { getPersistenceHealth } from '../../db/persistenceHealth';
import { isDbConfigured } from '../../db/usersRepo';
import { getDb } from '../../db/index';

export const healthRouter = Router();

healthRouter.get('/healthz', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

healthRouter.get('/readyz', async (_req, res) => {
  const persistence = getPersistenceHealth();
  if (!isDbConfigured()) {
    return res.status(200).json({ status: 'ok', database: 'not_configured', persistence });
  }
  try {
    await getDb().execute(sql`select 1`);
    res.status(200).json({ status: 'ok', database: 'reachable', persistence });
  } catch (err: any) {
    res.status(503).json({ status: 'unavailable', database: 'unreachable', error: err?.message, persistence });
  }
});
