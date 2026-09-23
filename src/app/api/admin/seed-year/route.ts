import { withPersistenceScope } from '../../../../lib/db/persistenceScope';
import { hydrateServerlessState } from '../../../../server/stateLoader';
import { seedYearData } from '../../../../services/admin/admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: Request): Promise<Response> {
  return withPersistenceScope(async () => {
    await hydrateServerlessState();
    const body = await request.json().catch(() => ({}));
    const result = await seedYearData(request.headers.get('x-user-id'), body);
    return Response.json(result.body, { status: result.status });
  });
}
