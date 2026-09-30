import { uploadToSupabase } from '../../../services/storage/supabaseStorage';
import { enforceApiRateLimit } from '../../../services/http/rateLimit';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: Request): Promise<Response> {
  const limited = await enforceApiRateLimit(request, '/upload');
  if (limited) return limited;
  
  const contentType = request.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    const { createSupabaseSignedUpload } = await import('../../../services/storage/supabaseStorage');
    return createSupabaseSignedUpload(request);
  }
  return uploadToSupabase(request);
}
