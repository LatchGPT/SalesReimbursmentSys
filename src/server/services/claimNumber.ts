import { isDbConfigured } from '../../db/usersRepo';
import { nextClaimNumberFromDb } from '../../db/coreLoopRepo';
import { state } from '../state';

export async function generateClaimNumber(): Promise<string> {
  if (isDbConfigured()) {
    return nextClaimNumberFromDb();
  }
  const year = new Date().getFullYear();
  const numStr = String(state.claimCounter++).padStart(6, '0');
  return `REIM-${year}-${numStr}`;
}
