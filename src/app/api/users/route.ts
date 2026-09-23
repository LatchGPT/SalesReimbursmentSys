import { hydrateServerlessState } from '../../../server/stateLoader';
import { listUsers } from '../../../services/users/usersRouter';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  await hydrateServerlessState();
  const result = listUsers(request.headers.get('x-user-id'));
  return Response.json(result.body, { status: result.status });
}
