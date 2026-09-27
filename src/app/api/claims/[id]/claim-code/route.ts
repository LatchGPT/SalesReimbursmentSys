import { withPersistenceScope } from '../../../../../lib/db/persistenceScope';
import { hydrateServerlessState } from '../../../../../server/stateLoader';
import { generateClaimCode } from '../../../../../services/claims/claims';
import { timedRoute } from '../../../../../lib/http/timedRoute';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Context = { params: Promise<{ id: string }> };

export async function PUT(request: Request, context: Context): Promise<Response> {
  return timedRoute('claim-code', measure => withPersistenceScope(async () => {
    await measure('hydrate', () => hydrateServerlessState('claim-transition'));
    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));
    const result = await measure('decision', () => generateClaimCode(request.headers.get('x-user-id'), id, body));
    return Response.json(result.body, { status: result.status });
  }));
}
