import { withPersistenceScope } from '../../../lib/db/persistenceScope';
import { hydrateServerlessState } from '../../../server/stateLoader';
import { createUser, listUsers } from '../../../services/users/usersRouter';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  await hydrateServerlessState();
  const result = listUsers(request.headers.get('x-user-id'));
  return Response.json(result.body, { status: result.status });
}

export async function POST(request: Request) {
  return withPersistenceScope(async () => {
    await hydrateServerlessState();
    let body: any;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: 'Invalid JSON body.' }, { status: 400 });
    }
    const result = await createUser(request.headers.get('x-user-id'), body);
    return Response.json(result.body, { status: result.status });
  });
}
