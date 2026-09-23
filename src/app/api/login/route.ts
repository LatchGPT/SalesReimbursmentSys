import { withPersistenceScope } from '../../../lib/db/persistenceScope';
import { hydrateServerlessState } from '../../../server/stateLoader';
import { loginUser } from '../../../services/auth/auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: Request): Promise<Response> {
  return withPersistenceScope(async () => {
    await hydrateServerlessState();
    let body;
    try {
      const text = await request.text();
      body = text ? JSON.parse(text) : {};
    } catch {
      return Response.json({ error: 'Invalid JSON body.' }, { status: 400 });
    }
    const result = loginUser(body);
    return Response.json(result.body, { status: result.status });
  });
}
