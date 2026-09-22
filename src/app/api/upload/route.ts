import { uploadToSupabase } from '../../../services/storage/supabaseStorage';
import { enforceApiRateLimit } from '../../../services/http/apiDispatcher';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: Request): Promise<Response> {
  const limited = await enforceApiRateLimit(request, '/upload');
  return limited || uploadToSupabase(request);
}
