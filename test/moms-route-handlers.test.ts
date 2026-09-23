import { afterEach, describe, expect, it } from 'vitest';
import { GET as list, POST as create } from '../src/app/api/moms/route';
import { GET as detail } from '../src/app/api/moms/[id]/route';
import { POST as send } from '../src/app/api/moms/[id]/send/route';
import { MomStatus, MinutesSource } from '../src/lib/db/serverTypes';
import { state } from '../src/server/state';

const originalMoms = state.moms;
const originalEmails = state.emails;
const originalTeamsMessages = state.teamsMessages;

afterEach(() => {
  state.moms = originalMoms;
  state.emails = originalEmails;
  state.teamsMessages = originalTeamsMessages;
});

describe('MOM explicit Route Handlers', () => {
  it('preserves unauthorized and custodian access responses', async () => {
    expect((await list(new Request('http://test/api/moms'))).status).toBe(401);
    state.moms = [{ id: 'mom-1', requestor_id: 'u1', document_type: 'MoM', client: 'Client', contact_person: '', contact_person_email: '', cc_client: false, meeting_date: '2026-01-01', meeting_time: '', location: '', purpose: '', discussion: '', agreements: '', action_items: '', prepared_by: 'Alice Reyes', status: MomStatus.DRAFT, created_at: '2026-01-01T00:00:00.000Z', minutes_source: MinutesSource.TEMPLATE }];
    const response = await detail(new Request('http://test/api/moms/mom-1', { headers: { 'X-User-Id': 'u3' } }), { params: Promise.resolve({ id: 'mom-1' }) });
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: 'Forbidden' });
  });

  it('creates and sends a requestor-owned MOM through explicit handlers', async () => {
    state.moms = [];
    const createResponse = await create(new Request('http://test/api/moms', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-User-Id': 'u1' }, body: JSON.stringify({ client: 'Explicit Handler Client', contact_person_email: 'client@example.com' }) }));
    expect(createResponse.status).toBe(200);
    const mom = await createResponse.json();
    expect(mom.status).toBe(MomStatus.DRAFT);
    const sendResponse = await send(new Request(`http://test/api/moms/${mom.id}/send`, { method: 'POST', headers: { 'X-User-Id': 'u1' } }), { params: Promise.resolve({ id: mom.id }) });
    expect(sendResponse.status).toBe(200);
    expect((await sendResponse.json()).status).toBe(MomStatus.COMPLETED);
  });
});
