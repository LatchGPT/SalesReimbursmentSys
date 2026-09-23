import { withPersistenceScope } from '../../../../lib/db/persistenceScope';
import { hydrateServerlessState } from '../../../../server/stateLoader';
import { deleteUser, updateUser } from '../../../../services/users/usersRouter';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
type Context = { params: Promise<{ id: string }> };

export async function PUT(request: Request, context: Context) {
  return withPersistenceScope(async () => {
    await hydrateServerlessState();
    const { id } = await context.params;
    let body: any;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: 'Invalid JSON body.' }, { status: 400 });
    }
    const result = await updateUser(request.headers.get('x-user-id'), id, body);
    return Response.json(result.body, { status: result.status });
  });
}

export async function DELETE(request: Request, context: Context) {
  return withPersistenceScope(async () => {
    await hydrateServerlessState();
    const { id } = await context.params;
    const result = await deleteUser(request.headers.get('x-user-id'), id);
    return Response.json(result.body, { status: result.status });
  });
}
