import { withPersistenceScope } from '../../../../lib/db/persistenceScope';
import { createMasterData, listMasterData } from '../../../../services/admin/masterDataRouter';
import { hydrateServerlessState } from '../../../../server/stateLoader';
export const dynamic = 'force-dynamic'; export const runtime = 'nodejs';
type Context = { params: Promise<{ entity: string }> };
export async function GET(request: Request, context: Context) { await hydrateServerlessState(); const { entity } = await context.params; const result = listMasterData(request.headers.get('x-user-id'), entity); return Response.json(result.body, { status: result.status }); }
export async function POST(request: Request, context: Context) { return withPersistenceScope(async () => { await hydrateServerlessState(); const { entity } = await context.params; const result = await createMasterData(request.headers.get('x-user-id'), entity, await request.json()); return Response.json(result.body, { status: result.status }); }); }
