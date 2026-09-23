import { hydrateServerlessState } from '../../../server/stateLoader';
import { listLiquidations } from '../../../services/liquidations/liquidations';
import { createLiquidation } from '../../../services/liquidations/liquidations'; import { withPersistenceScope } from '../../../lib/db/persistenceScope';
export const dynamic = 'force-dynamic'; export const runtime = 'nodejs';
export async function GET(request: Request) { await hydrateServerlessState(); const result = listLiquidations(request.headers.get('x-user-id')); return Response.json(result.body, { status: result.status }); }
export async function POST(request: Request) { return withPersistenceScope(async () => { await hydrateServerlessState(); const result = await createLiquidation(request.headers.get('x-user-id'), await request.json()); return Response.json(result.body, { status: result.status }); }); }
