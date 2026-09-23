import { withPersistenceScope } from '../../../../../../lib/db/persistenceScope';
import { hydrateServerlessState } from '../../../../../../server/stateLoader';
import { updateLiquidationLineItem, deleteLiquidationLineItem } from '../../../../../../services/liquidations/liquidations';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Context = { params: Promise<{ id: string; itemId: string }> };

export async function PUT(request: Request, context: Context): Promise<Response> {
  return withPersistenceScope(async () => {
    await hydrateServerlessState();
    const { id, itemId } = await context.params;
    const body = await request.json().catch(() => ({}));
    const result = await updateLiquidationLineItem(request.headers.get('x-user-id'), id, itemId, body);
    return Response.json(result.body, { status: result.status });
  });
}

export async function DELETE(request: Request, context: Context): Promise<Response> {
  return withPersistenceScope(async () => {
    await hydrateServerlessState();
    const { id, itemId } = await context.params;
    const result = await deleteLiquidationLineItem(request.headers.get('x-user-id'), id, itemId);
    return Response.json(result.body, { status: result.status });
  });
}
