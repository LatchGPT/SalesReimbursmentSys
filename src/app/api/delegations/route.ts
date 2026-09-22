import { withPersistenceScope } from '../../../lib/db/persistenceScope';
import { hydrateServerlessState } from '../../../server/stateLoader';
import { createDelegation, listDelegations } from '../../../services/users/delegationsRouter';
export const dynamic = 'force-dynamic'; export const runtime = 'nodejs';
export async function GET(request: Request) { await hydrateServerlessState(); const result = listDelegations(request.headers.get('x-user-id')); return Response.json(result.body, { status: result.status }); }
export async function POST(request: Request) { return withPersistenceScope(async () => { await hydrateServerlessState(); const result = await createDelegation(request.headers.get('x-user-id'), await request.json()); return Response.json(result.body, { status: result.status }); }); }
