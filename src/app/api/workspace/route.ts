import { hydrateServerlessState } from '@/server/stateLoader';
import { getWorkspacePayload } from '@/server/services/workspaceService';
import { withPersistenceScope } from '@/lib/db/persistenceScope';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request): Promise<Response> {
  const startedAt = performance.now();
  let hydrationMs = 0;
  let payloadMs = 0;
  const response = await withPersistenceScope(async () => {
    const hydrationStartedAt = performance.now();
    await hydrateServerlessState();
    hydrationMs = performance.now() - hydrationStartedAt;

    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Unauthorized: missing X-User-Id' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
      });
    }

    const payloadStartedAt = performance.now();
    const payload = getWorkspacePayload(userId);
    payloadMs = performance.now() - payloadStartedAt;
    if (!payload) {
      return new Response(JSON.stringify({ error: 'Unauthorized: user not found' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
      });
    }

    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  });
  const totalMs = performance.now() - startedAt;
  response.headers.set(
    'Server-Timing',
    `hydrate;dur=${hydrationMs.toFixed(1)}, payload;dur=${payloadMs.toFixed(1)}, total;dur=${totalMs.toFixed(1)}`,
  );
  console.info('[performance] workspace', {
    hydrationMs: Number(hydrationMs.toFixed(1)),
    payloadMs: Number(payloadMs.toFixed(1)),
    totalMs: Number(totalMs.toFixed(1)),
  });
  return response;
}
