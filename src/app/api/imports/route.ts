import { withPersistenceScope } from '../../../lib/db/persistenceScope';
import { hydrateServerlessState } from '../../../server/stateLoader';
import { listImports, createImport } from '../../../services/admin/admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request): Promise<Response> {
  return withPersistenceScope(async () => {
    await hydrateServerlessState();
    const result = listImports(request.headers.get('x-user-id'));
    return Response.json(result.body, { status: result.status });
  });
}

export async function POST(request: Request): Promise<Response> {
  return withPersistenceScope(async () => {
    await hydrateServerlessState();
    const body = await request.json().catch(() => ({}));
    const result = await createImport(request.headers.get('x-user-id'), body);
    return Response.json(result.body, { status: result.status });
  });
}
