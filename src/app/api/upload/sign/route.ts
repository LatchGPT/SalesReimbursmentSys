import { enforceApiRateLimit } from '../../../../services/http/apiDispatcher';
import { createSupabaseSignedUpload } from '../../../../services/storage/supabaseStorage';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: Request): Promise<Response> {
  const limited = await enforceApiRateLimit(request, '/upload/sign');
  return limited || createSupabaseSignedUpload(request);
}
