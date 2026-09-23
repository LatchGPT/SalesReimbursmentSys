import { withPersistenceScope } from '../../../../../lib/db/persistenceScope';
import { hydrateServerlessState } from '../../../../../server/stateLoader';
import { submitCashAdvance } from '../../../../../services/cash-advances/cashAdvances';
export const dynamic = 'force-dynamic'; export const runtime = 'nodejs'; type Context = { params: Promise<{ id: string }> };
export async function POST(request: Request, context: Context) { return withPersistenceScope(async () => { await hydrateServerlessState(); const { id } = await context.params; const result = await submitCashAdvance(request.headers.get('x-user-id'), id); return Response.json(result.body, { status: result.status }); }); }
