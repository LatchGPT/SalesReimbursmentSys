import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { PrismaClient } from '../generated/prisma/client';

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
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is required before accessing Prisma');
  }

  const configuredPoolMax = Number(process.env.DATABASE_POOL_MAX || '1');
  const poolMax = Number.isSafeInteger(configuredPoolMax) && configuredPoolMax > 0
    ? configuredPoolMax
    : 1;
  const pool = new Pool({
    connectionString,
    // A Vercel deployment can create many function instances. Keep each
    // instance's pool small and let Supabase's transaction pooler multiplex it.
    max: poolMax,
    connectionTimeoutMillis: 10_000,
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

  if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.salesReimbursementPrisma ??= createPrismaClient();
    return globalForPrisma.salesReimbursementPrisma;
  }

  productionPrisma ??= createPrismaClient();
  return productionPrisma;
}

export async function disconnectDb(): Promise<void> {
  const client = process.env.NODE_ENV === 'production'
    ? productionPrisma
    : globalForPrisma.salesReimbursementPrisma;

  if (client) await client.$disconnect();

  productionPrisma = undefined;
  globalForPrisma.salesReimbursementPrisma = undefined;
}

export type Db = PrismaClientInstance;
