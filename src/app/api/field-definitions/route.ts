import { withPersistenceScope } from '../../../lib/db/persistenceScope';
import { createFieldDefinition, listFieldDefinitions } from '../../../services/admin/fieldDefinitionsRouter';
import { hydrateServerlessState } from '../../../server/stateLoader';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export async function GET(request: Request) { await hydrateServerlessState(); const result = listFieldDefinitions(request.headers.get('x-user-id'), new URL(request.url).searchParams.get('entity') || undefined); return Response.json(result.body, { status: result.status }); }
export async function POST(request: Request) { return withPersistenceScope(async () => { await hydrateServerlessState(); const result = await createFieldDefinition(request.headers.get('x-user-id'), await request.json()); return Response.json(result.body, { status: result.status }); }); }
