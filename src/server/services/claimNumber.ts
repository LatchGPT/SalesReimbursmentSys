import { isDbAvailable, nextClaimNumberFromDb } from '../../lib/db/coreLoopRepo';
import { serverEnv } from '../../config/env';
import { state } from '../state';

export async function generateClaimNumber(): Promise<string> {
  if (isDbAvailable()) {
    try {
      return await nextClaimNumberFromDb();
    } catch (err) {
      if (!serverEnv.isProduction) {
        const msg = err instanceof Error ? err.message : String(err);
        if (
          msg.includes('timeout') ||
          msg.includes('connect') ||
          msg.includes('Connection terminated')
        ) {
          (globalThis as any).dbConnectionFailed = true;
        }
      }
      console.warn(
        '[db] Could not get next claim number from database sequence, falling back to state counter:',
        err instanceof Error ? err.message : err,
      );
    }
  }
  const year = new Date().getFullYear();
  const numStr = String(state.claimCounter++).padStart(6, '0');
  return `REIM-${year}-${numStr}`;
}
