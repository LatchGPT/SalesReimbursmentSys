import { AsyncLocalStorage } from 'node:async_hooks';

const pendingWrites = new AsyncLocalStorage<Promise<unknown>[]>();

/** Track legacy fire-and-forget writes so a serverless request can await them. */
export function trackPersistence(promise: Promise<unknown>): void {
  pendingWrites.getStore()?.push(promise);
}

export async function withPersistenceScope<T>(operation: () => Promise<T>): Promise<T> {
  return pendingWrites.run([], async () => {
    const result = await operation();
    const writes = pendingWrites.getStore() || [];
    if (writes.length > 0) await Promise.all(writes);
    return result;
  });
}
