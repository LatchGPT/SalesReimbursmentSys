import { withPersistenceScope } from '../../../lib/db/persistenceScope';
import { hydrateServerlessState } from '../../../server/stateLoader';
import { createMom, listMoms } from '../../../services/moms/moms';
export const dynamic = 'force-dynamic'; export const runtime = 'nodejs';
export async function GET(request: Request) { await hydrateServerlessState(); const result = listMoms(request.headers.get('x-user-id')); return Response.json(result.body, { status: result.status }); }
export async function POST(request: Request) { return withPersistenceScope(async () => { await hydrateServerlessState(); const result = await createMom(request.headers.get('x-user-id'), await request.json()); return Response.json(result.body, { status: result.status }); }); }
