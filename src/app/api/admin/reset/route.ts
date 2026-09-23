import { withPersistenceScope } from '../../../../lib/db/persistenceScope';
import { hydrateServerlessState } from '../../../../server/stateLoader';
import { resetSimulation } from '../../../../services/admin/admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: Request): Promise<Response> {
  return withPersistenceScope(async () => {
    await hydrateServerlessState();
    const result = await resetSimulation(request.headers.get('x-user-id'));
    return Response.json(result.body, { status: result.status });
  });
}
