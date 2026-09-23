import { hydrateServerlessState } from '../../../server/stateLoader';
import { withPersistenceScope } from '../../../lib/db/persistenceScope';
import { createCashAdvance, listCashAdvances } from '../../../services/cash-advances/cashAdvances';
export const dynamic = 'force-dynamic'; export const runtime = 'nodejs';
export async function GET(request: Request) { await hydrateServerlessState(); const result = listCashAdvances(request.headers.get('x-user-id')); return Response.json(result.body, { status: result.status }); }
export async function POST(request: Request) { return withPersistenceScope(async () => { await hydrateServerlessState(); const result = await createCashAdvance(request.headers.get('x-user-id'), await request.json()); return Response.json(result.body, { status: result.status }); }); }
