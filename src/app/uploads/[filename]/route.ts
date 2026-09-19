import { downloadFromSupabase } from '../../../../backend/src/server/http/storageHandlers';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Context = { params: Promise<{ filename: string }> };

export async function GET(request: Request, context: Context): Promise<Response> {
  const { filename } = await context.params;
  return downloadFromSupabase(request, filename);
}
