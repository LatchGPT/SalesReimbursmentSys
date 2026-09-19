import { enforceApiRateLimit } from '../../../../../backend/src/server/http/routeHandlerAdapter';
import { createSupabaseSignedUpload } from '../../../../../backend/src/server/http/storageHandlers';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: Request): Promise<Response> {
  const limited = await enforceApiRateLimit(request, '/upload/sign');
  return limited || createSupabaseSignedUpload(request);
}
