import { uploadToSupabase } from '../../../../backend/src/server/http/storageHandlers';
import { enforceApiRateLimit } from '../../../../backend/src/server/http/routeHandlerAdapter';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: Request): Promise<Response> {
  const limited = await enforceApiRateLimit(request, '/upload');
  return limited || uploadToSupabase(request);
}
