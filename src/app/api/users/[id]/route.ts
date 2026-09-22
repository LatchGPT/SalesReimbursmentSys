import { withPersistenceScope } from '../../../../lib/db/persistenceScope';
import { hydrateServerlessState } from '../../../../server/stateLoader';
import { updateUser } from '../../../../services/users/usersRouter';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
type Context = { params: Promise<{ id: string }> };

export async function PUT(request: Request, context: Context) {
  return withPersistenceScope(async () => {
    await hydrateServerlessState();
    const { id } = await context.params;
    const result = await updateUser(request.headers.get('x-user-id'), id, await request.json());
    return Response.json(result.body, { status: result.status });
  });
}
