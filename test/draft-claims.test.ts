import { describe, expect, it } from 'vitest';
import { dispatchTestRequest } from './testRouter';
import { ClaimStatus, MomStatus } from '../src/lib/db/serverTypes';
import { state } from '../src/server/state';

async function callApi(path: string, init: RequestInit = {}): Promise<Response> {
  return dispatchTestRequest(path, init);
}

describe('Draft Requests and Submission', () => {
  const aliceId = 'u1'; // Alice Reyes (Requestor, reports to Bob u2)

  it('saves a draft reimbursement claim with incomplete data (no receipts, 0 amount, no MOM)', async () => {
    const res = await callApi('/api/claims', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Id': aliceId,
      },
      body: JSON.stringify({
        claim_type: 'Reimbursement',
        remarks: 'Partially completed meeting draft',
        is_draft: true,
        line_items: [
          {
            category: '',
            amount: 0,
            receipt_url: '',
            vendor: 'Cafe Draft',
            business_purpose: 'Lunch with client',
          },
        ],
      }),
    });

    expect(res.status).toBe(200);
    const draft = await res.json();
    expect(draft.id).toBeDefined();
    expect(draft.status).toBe(ClaimStatus.DRAFT);
    expect(draft.total_amount).toBe(0);

    // Verify it is in state.claims
    const stored = state.claims.find(c => c.id === draft.id);
    expect(stored).toBeDefined();
    expect(stored?.status).toBe(ClaimStatus.DRAFT);
  });

  it('submits a draft reimbursement claim once completed', async () => {
    // 1. Create a draft claim
    const draftRes = await callApi('/api/claims', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Id': aliceId,
      },
      body: JSON.stringify({
        claim_type: 'Reimbursement',
        remarks: 'Draft to be finalized',
        is_draft: true,
        line_items: [],
      }),
    });
    expect(draftRes.status).toBe(200);
    const draft = await draftRes.json();

    // 2. Create a completed MOM to attach
    const momRes = await callApi('/api/moms', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Id': aliceId,
      },
      body: JSON.stringify({
        client: 'Acme Corp',
        purpose: 'Strategy alignment',
        meeting_date: new Date().toISOString().split('T')[0],
        status: MomStatus.COMPLETED,
      }),
    });
    expect(momRes.status).toBe(200);
    const mom = await momRes.json();

    // 3. Resubmit/complete the draft claim
    const submitRes = await callApi(`/api/claims/${draft.id}/resubmit`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Id': aliceId,
      },
      body: JSON.stringify({
        claim_type: 'Reimbursement',
        mom_id: mom.id,
        remarks: 'Finalized submission',
        line_items: [
          {
            category: 'Meals',
            amount: 500,
            receipt_url: 'https://storage.local/receipt.png',
            vendor: 'Bistro Manila',
            expense_date: new Date().toISOString().split('T')[0],
            business_purpose: 'Lunch with Acme team',
          },
        ],
      }),
    });

    expect(submitRes.status).toBe(200);
    const submitted = await submitRes.json();
    expect(submitted.status).toBe(ClaimStatus.PENDING_APPROVAL);
    expect(submitted.total_amount).toBe(500);

    const stored = state.claims.find(c => c.id === draft.id);
    expect(stored?.status).toBe(ClaimStatus.PENDING_APPROVAL);
  });

  it('allows discarding a draft claim via DELETE /api/claims/:id', async () => {
    // 1. Create a draft claim
    const draftRes = await callApi('/api/claims', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Id': aliceId,
      },
      body: JSON.stringify({
        claim_type: 'Transport Reimbursement',
        remarks: 'Discard me',
        is_draft: true,
        line_items: [],
      }),
    });
    expect(draftRes.status).toBe(200);
    const draft = await draftRes.json();

    // 2. Delete the draft
    const deleteRes = await callApi(`/api/claims/${draft.id}`, {
      method: 'DELETE',
      headers: {
        'X-User-Id': aliceId,
      },
    });
    expect(deleteRes.status).toBe(200);

    // 3. Confirm it no longer exists
    const checkRes = await callApi(`/api/claims/${draft.id}`, {
      headers: { 'X-User-Id': aliceId },
    });
    expect(checkRes.status).toBe(404);
  });

  it('rejects deleting a non-draft claim', async () => {
    // Find an existing approved/processing claim
    const activeClaim = state.claims.find(c => c.status !== ClaimStatus.DRAFT && c.requestor_id === aliceId);
    if (activeClaim) {
      const deleteRes = await callApi(`/api/claims/${activeClaim.id}`, {
        method: 'DELETE',
        headers: { 'X-User-Id': aliceId },
      });
      expect(deleteRes.status).toBe(400);
    }
  });

  it('saves a draft cash advance with 0 amount', async () => {
    // Clear any unliquidated cash advances for Alice for this isolated check
    const existing = state.cashAdvances.filter(ca => ca.requestorId === aliceId);
    existing.forEach(ca => { ca.status = 'Liquidated' as any; });

    const caRes = await callApi('/api/cash-advances', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Id': aliceId,
      },
      body: JSON.stringify({
        amount: 0,
        purpose: '',
        is_draft: true,
      }),
    });

    expect(caRes.status).toBe(200);
    const ca = await caRes.json();
    expect(ca.status).toBe('Draft');
    expect(ca.amount).toBe(0);
  });
});
