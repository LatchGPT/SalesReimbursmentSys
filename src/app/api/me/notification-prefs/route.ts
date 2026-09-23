import { withPersistenceScope } from '../../../../lib/db/persistenceScope';
import { hydrateServerlessState } from '../../../../server/stateLoader';
import { updateNotificationPrefs } from '../../../../services/auth/auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function PUT(request: Request): Promise<Response> {
  return withPersistenceScope(async () => {
    await hydrateServerlessState();
    const body = await request.json().catch(() => ({}));
    const result = await updateNotificationPrefs(request.headers.get('x-user-id'), body);
    return Response.json(result.body, { status: result.status });
  });
}
