import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { PrismaClient } from '../generated/prisma/client';

type PrismaClientInstance = InstanceType<typeof PrismaClient>;

const globalForPrisma = globalThis as typeof globalThis & {
  salesReimbursementPrisma?: PrismaClientInstance;
};

let testDbOverride: PrismaClientInstance | undefined;

/** Test-only seam for injecting a Prisma client backed by pg-mem. */
export function __setTestDb(db: PrismaClientInstance | undefined) {
  testDbOverride = db;
}

function createPrismaClient(): PrismaClientInstance {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is required before accessing Prisma');
  }

  const pool = new Pool({
    connectionString,
    max: 10,
    connectionTimeoutMillis: 10_000,
  });
  const adapter = new PrismaPg(pool, { disposeExternalPool: true });
  return new PrismaClient({ adapter });
}

/**
 * The only Prisma client factory in the application. The global cache avoids
 * opening a new pool during local hot reloads while Render keeps one client
 * for the lifetime of its persistent process.
 */
export function getDb(): PrismaClientInstance {
  if (testDbOverride) return testDbOverride;

  if (!globalForPrisma.salesReimbursementPrisma) {
    globalForPrisma.salesReimbursementPrisma = createPrismaClient();
  }
  return globalForPrisma.salesReimbursementPrisma;
}

export async function disconnectDb(): Promise<void> {
  if (globalForPrisma.salesReimbursementPrisma) {
    await globalForPrisma.salesReimbursementPrisma.$disconnect();
    globalForPrisma.salesReimbursementPrisma = undefined;
  }
}

export type Db = PrismaClientInstance;
