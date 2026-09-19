import { apiFetch } from '../../../lib/api/client';

export const releaseCashAdvance = (id: string, releaseReference: string, releaseMethod: string) =>
  apiFetch(`/api/cash-advances/${id}/release`, {
    method: 'POST',
    body: JSON.stringify({ releaseReference, releaseMethod }),
  });

export interface SubmitCashAdvanceInput {
  amount: number;
  purpose: string;
  momId?: string;
  isDraft?: boolean;
}

/**
 * A Cash Advance has no expense line items — it's just an amount + purpose
 * routed to the requestor's approver. Draft creation and submission are two
 * separate server calls (POST /api/cash-advances, then .../submit) so a draft
 * can be created and left for later without ever hitting `submit`.
 */
export async function submitCashAdvanceFlow(input: SubmitCashAdvanceInput) {
  const ca = await apiFetch('/api/cash-advances', {
    method: 'POST',
    body: JSON.stringify({
      amount: input.amount,
      purpose: input.purpose,
      momId: input.momId,
    }),
  });
  if (input.isDraft) return ca;
  return apiFetch(`/api/cash-advances/${ca.id}/submit`, { method: 'POST' });
}
