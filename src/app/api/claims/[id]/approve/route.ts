import { withPersistenceScope } from '../../../../../lib/db/persistenceScope';
import { hydrateServerlessState } from '../../../../../server/stateLoader';
import { approveClaim } from '../../../../../services/claims/claims';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context): Promise<Response> {
  const startedAt = performance.now();
  let hydrationMs = 0;
  let decisionMs = 0;
  const response = await withPersistenceScope(async () => {
    const hydrationStartedAt = performance.now();
    await hydrateServerlessState('claim-approval');
    hydrationMs = performance.now() - hydrationStartedAt;
    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));
    const decisionStartedAt = performance.now();
    const result = await approveClaim(request.headers.get('x-user-id'), id, body);
    decisionMs = performance.now() - decisionStartedAt;
    return Response.json(result.body, { status: result.status });
  });
  const totalMs = performance.now() - startedAt;
  response.headers.set(
    'Server-Timing',
    `hydrate;dur=${hydrationMs.toFixed(1)}, decision;dur=${decisionMs.toFixed(1)}, total;dur=${totalMs.toFixed(1)}`,
  );
  console.info('[performance] claim approval', {
    hydrationMs: Number(hydrationMs.toFixed(1)),
    decisionMs: Number(decisionMs.toFixed(1)),
    totalMs: Number(totalMs.toFixed(1)),
  });
  return response;
}
