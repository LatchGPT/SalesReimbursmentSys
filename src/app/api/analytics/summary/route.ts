import { hydrateServerlessState } from '../../../../server/stateLoader';
import { getAnalyticsSummary } from '../../../../services/analytics/analytics';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  await hydrateServerlessState();
  const result = getAnalyticsSummary(request.headers.get('x-user-id'), new URL(request.url).searchParams);
  return Response.json(result.body, { status: result.status });
}
