import { withPersistenceScope } from '../../../../lib/db/persistenceScope';
import { hydrateServerlessState } from '../../../../server/stateLoader';
import { getAdminSettings, updateAdminSettings } from '../../../../services/admin/admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request): Promise<Response> {
  return withPersistenceScope(async () => {
    await hydrateServerlessState();
    const result = getAdminSettings(request.headers.get('x-user-id'));
    return Response.json(result.body, { status: result.status });
  });
}

export async function PUT(request: Request): Promise<Response> {
  return withPersistenceScope(async () => {
    await hydrateServerlessState();
    const body = await request.json().catch(() => ({}));
    const result = await updateAdminSettings(request.headers.get('x-user-id'), body);
    return Response.json(result.body, { status: result.status });
  });
}
