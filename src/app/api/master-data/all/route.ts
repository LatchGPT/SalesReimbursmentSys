import { listAllMasterData } from '../../../../services/admin/masterDataRouter';
import { hydrateServerlessState } from '../../../../server/stateLoader';
export const dynamic = 'force-dynamic'; export const runtime = 'nodejs';
export async function GET(request: Request) { await hydrateServerlessState(); const result = listAllMasterData(request.headers.get('x-user-id')); return Response.json(result.body, { status: result.status }); }
