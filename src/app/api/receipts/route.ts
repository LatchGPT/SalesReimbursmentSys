import { listReceipts } from '../../../services/claims/receipts';
import { hydrateServerlessState } from '../../../server/stateLoader';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request): Promise<Response> {
  await hydrateServerlessState();
  const result = listReceipts(request.headers.get('x-user-id'));
  return Response.json(result.body, { status: result.status });
}
