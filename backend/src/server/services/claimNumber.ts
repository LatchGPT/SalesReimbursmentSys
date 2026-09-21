import { isDbConfigured } from '../../db/usersRepo';
import { nextClaimNumberFromDb } from '../../db/coreLoopRepo';
import { state } from '../state';

export async function generateClaimNumber(): Promise<string> {
  if (isDbConfigured()) {
    try {
      return await nextClaimNumberFromDb();
    } catch (err) {
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
