import { getMicrosoftStart } from '../../../../../services/auth/auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(): Promise<Response> {
  const result = getMicrosoftStart();
  return Response.json(result.body, { status: result.status });
}
