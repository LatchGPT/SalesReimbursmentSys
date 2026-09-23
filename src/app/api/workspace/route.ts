import { hydrateServerlessState } from '@/server/stateLoader';
import { getWorkspacePayload } from '@/server/services/workspaceService';
import { withPersistenceScope } from '@/lib/db/persistenceScope';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request): Promise<Response> {
  return withPersistenceScope(async () => {
    await hydrateServerlessState();

    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Unauthorized: missing X-User-Id' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
      });
    }

    const payload = getWorkspacePayload(userId);
    if (!payload) {
      return new Response(JSON.stringify({ error: 'Unauthorized: user not found' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
      });
    }

    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  });
}
