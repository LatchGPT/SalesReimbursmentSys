import { withPersistenceScope } from '../../../lib/db/persistenceScope';
import { hydrateServerlessState } from '../../../server/stateLoader';
import { getCurrentUser } from '../../../services/auth/auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request): Promise<Response> {
  return withPersistenceScope(async () => {
    await hydrateServerlessState();
    const result = getCurrentUser(request.headers.get('x-user-id'));
    return Response.json(result.body, { status: result.status });
  });
}
