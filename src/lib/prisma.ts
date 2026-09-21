import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { PrismaClient } from '../generated/prisma/client';
import { requireServerValue, serverEnv } from '../config/env';

type PrismaClientInstance = InstanceType<typeof PrismaClient>;

const globalForPrisma = globalThis as typeof globalThis & {
  salesReimbursementPrisma?: PrismaClientInstance;
};

let productionPrisma: PrismaClientInstance | undefined;
let testDbOverride: PrismaClientInstance | undefined;

/** Test-only seam for injecting a Prisma client backed by pg-mem. */
export function __setTestDb(db: PrismaClientInstance | undefined): void {
  testDbOverride = db;
}

function createPrismaClient(): PrismaClientInstance {
  let connectionString = requireServerValue('DATABASE_URL', serverEnv.databaseUrl);
  const isLocal = connectionString.includes('localhost') || connectionString.includes('127.0.0.1');

  // Supabase poolers and serverless environments: prevent "self-signed certificate in certificate chain"
  if (!isLocal) {
    if (/sslmode=[^&]+/i.test(connectionString)) {
      connectionString = connectionString.replace(/sslmode=[^&]+/i, 'sslmode=no-verify');
    } else {
      const separator = connectionString.includes('?') ? '&' : '?';
      connectionString = `${connectionString}${separator}sslmode=no-verify`;
    }
  }

  const pool = new Pool({
    connectionString,
    // A Vercel deployment can create many function instances. Keep each
    // instance's pool small and let Supabase's transaction pooler multiplex it.
    max: serverEnv.databasePoolMax,
    connectionTimeoutMillis: 10_000,
    ...(!isLocal ? { ssl: { rejectUnauthorized: false } } : {}),
  });
  const adapter = new PrismaPg(pool, { disposeExternalPool: true });

  return new PrismaClient({ adapter });
}

/**
 * Returns the application's only Prisma client. Development caches the client
 * on globalThis so Next.js hot reloads do not create extra PostgreSQL pools.
 * Production keeps one module-scoped client per serverless function instance.
 */
export function getDb(): PrismaClientInstance {
  if (testDbOverride) return testDbOverride;

  if (!serverEnv.isProduction) {
    globalForPrisma.salesReimbursementPrisma ??= createPrismaClient();
    return globalForPrisma.salesReimbursementPrisma;
  }

  productionPrisma ??= createPrismaClient();
  return productionPrisma;
}

export async function disconnectDb(): Promise<void> {
  const client = serverEnv.isProduction
    ? productionPrisma
    : globalForPrisma.salesReimbursementPrisma;

  if (client) await client.$disconnect();

  productionPrisma = undefined;
  globalForPrisma.salesReimbursementPrisma = undefined;
}

export type Db = PrismaClientInstance;
