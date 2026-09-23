import { withPersistenceScope } from '../../../../../lib/db/persistenceScope';
import { hydrateServerlessState } from '../../../../../server/stateLoader';
import { resubmitClaim } from '../../../../../services/claims/claims';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Context = { params: Promise<{ id: string }> };

export async function PUT(request: Request, context: Context): Promise<Response> {
  return withPersistenceScope(async () => {
    await hydrateServerlessState();
    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));
    const result = await resubmitClaim(request.headers.get('x-user-id'), id, body);
    return Response.json(result.body, { status: result.status });
  });
}
