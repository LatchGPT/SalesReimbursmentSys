import { withPersistenceScope } from '../../../../../lib/db/persistenceScope';
import { updateMasterData } from '../../../../../services/admin/masterDataRouter';
import { hydrateServerlessState } from '../../../../../server/stateLoader';
export const dynamic = 'force-dynamic'; export const runtime = 'nodejs';
type Context = { params: Promise<{ entity: string; id: string }> };
export async function PUT(request: Request, context: Context) { return withPersistenceScope(async () => { await hydrateServerlessState(); const { entity, id } = await context.params; const result = await updateMasterData(request.headers.get('x-user-id'), entity, id, await request.json()); return Response.json(result.body, { status: result.status }); }); }
