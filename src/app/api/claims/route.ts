import { withPersistenceScope } from '../../../lib/db/persistenceScope';
import { hydrateServerlessState } from '../../../server/stateLoader';
import { listClaims, createClaim } from '../../../services/claims/claims';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request): Promise<Response> {
  return withPersistenceScope(async () => {
    await hydrateServerlessState();
    const url = new URL(request.url);
    const result = listClaims(request.headers.get('x-user-id'), url.searchParams);
    return Response.json(result.body, { status: result.status });
  });
}

export async function POST(request: Request): Promise<Response> {
  const startedAt = performance.now();
  let hydrationMs = 0;
  let creationMs = 0;
  const response = await withPersistenceScope(async () => {
    const hydrationStartedAt = performance.now();
    await hydrateServerlessState('claim-submission');
    hydrationMs = performance.now() - hydrationStartedAt;
    const body = await request.json().catch(() => ({}));
    const creationStartedAt = performance.now();
    const result = await createClaim(request.headers.get('x-user-id'), body);
    creationMs = performance.now() - creationStartedAt;
    return Response.json(result.body, { status: result.status });
  });
  const totalMs = performance.now() - startedAt;
  response.headers.set(
    'Server-Timing',
    `hydrate;dur=${hydrationMs.toFixed(1)}, create;dur=${creationMs.toFixed(1)}, total;dur=${totalMs.toFixed(1)}`,
  );
  console.info('[performance] claim submission', {
    hydrationMs: Number(hydrationMs.toFixed(1)),
    creationMs: Number(creationMs.toFixed(1)),
    totalMs: Number(totalMs.toFixed(1)),
  });
  return response;
}
