import { withPersistenceScope } from '../../../../lib/db/persistenceScope';
import { hydrateServerlessState } from '../../../../server/stateLoader';
import { getMom, updateMom } from '../../../../services/moms/moms';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: Context): Promise<Response> {
  return withPersistenceScope(async () => {
    await hydrateServerlessState();
    const { id } = await context.params;
    const result = getMom(request.headers.get('x-user-id'), id);
    return Response.json(result.body, { status: result.status });
  });
}

export async function PUT(request: Request, context: Context): Promise<Response> {
  return withPersistenceScope(async () => {
    await hydrateServerlessState();
    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));
    const result = await updateMom(request.headers.get('x-user-id'), id, body);
    return Response.json(result.body, { status: result.status });
  });
}
