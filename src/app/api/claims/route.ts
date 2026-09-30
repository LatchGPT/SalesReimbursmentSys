import { withPersistenceScope } from '../../../lib/db/persistenceScope';
import { hydrateServerlessState } from '../../../server/stateLoader';
import { listClaims, createClaim } from '../../../services/claims/claims';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request): Promise<Response> {
  return withPersistenceScope(async () => {
    await hydrateServerlessState();
    const url = new URL(request.url);
    const result = listClaims(request.headers.get('x-user-id'), url.searchParams);
    return Response.json(result.body, { status: result.status });
  });
}

export async function POST(request: Request): Promise<Response> {
  return withPersistenceScope(async () => {
    await hydrateServerlessState();
    const body = await request.json().catch(() => ({}));
    const result = await createClaim(request.headers.get('x-user-id'), body);
    return Response.json(result.body, { status: result.status });
  });
}
