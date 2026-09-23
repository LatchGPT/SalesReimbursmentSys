import { hydrateServerlessState } from '../../../../server/stateLoader';
import { getCashAdvance } from '../../../../services/cash-advances/cashAdvances';
import { updateCashAdvance } from '../../../../services/cash-advances/cashAdvances';
import { withPersistenceScope } from '../../../../lib/db/persistenceScope';
export const dynamic = 'force-dynamic'; export const runtime = 'nodejs'; type Context = { params: Promise<{ id: string }> };
export async function GET(request: Request, context: Context) { await hydrateServerlessState(); const { id } = await context.params; const result = getCashAdvance(request.headers.get('x-user-id'), id); return Response.json(result.body, { status: result.status }); }
export async function PUT(request: Request, context: Context) { return withPersistenceScope(async () => { await hydrateServerlessState(); const { id } = await context.params; const result = await updateCashAdvance(request.headers.get('x-user-id'), id, await request.json()); return Response.json(result.body, { status: result.status }); }); }
