import { getDb } from '../../db';
import { getPersistenceHealth } from '../../db/persistenceHealth';
import { isDbConfigured } from '../../db/usersRepo';

const headers = {
  'Cache-Control': 'no-store',
  'Content-Type': 'application/json; charset=utf-8',
  'X-Content-Type-Options': 'nosniff',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers });

export function legacyApiHealth(): Response {
  return json({ Health: 'ok!' });
}

export function healthz(): Response {
  return json({ status: 'ok' });
}

export async function readyz(): Promise<Response> {
  const persistence = getPersistenceHealth();
  if (!isDbConfigured()) {
    return json({ status: 'ok', database: 'not_configured', persistence });
  }
  try {
    await getDb().$queryRaw`SELECT 1`;
    return json({ status: 'ok', database: 'reachable', persistence });
  } catch (error) {
    return json({
      status: 'unavailable',
      database: 'unreachable',
      error: error instanceof Error ? error.message : String(error),
      persistence,
    }, 503);
  }
}
