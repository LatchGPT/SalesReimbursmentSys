import { apiFetch, uploadFile } from './client';
import { DraftLineItem } from './claims';
import { normalizeExpenseCategory } from '../expenseCategories';

export interface SubmitLiquidationInput {
  cashAdvanceId: string;
  lineItems: DraftLineItem[];
  /** How the requestor will return an over-advance (only when a refund is due). */
  refundMethod?: string;
  isDraft?: boolean;
}

/**
 * A Liquidation settles a Released Cash Advance: create the (empty) report
 * against it, attach each expense as its own line item (receipts upload
 * first, same as a reimbursement), then submit for the approver's review.
 * The server computes total/variance itself on every line-item write.
 */
export async function submitLiquidationFlow(input: SubmitLiquidationInput) {
  const liquidation = await apiFetch('/api/liquidations', {
    method: 'POST',
    body: JSON.stringify({ cashAdvanceId: input.cashAdvanceId }),
  });

  for (const li of input.lineItems) {
    let receiptUrl = li.receiptUrl;
    if (li.receiptFile) {
      const up = await uploadFile(li.receiptFile);
      receiptUrl = up.url;
    }
    if (!receiptUrl) {
      throw new Error('Every liquidation expense needs a receipt attached before you can submit.');
    }
    await apiFetch(`/api/liquidations/${liquidation.id}/line-items`, {
      method: 'POST',
      body: JSON.stringify({
        expense_date: li.expenseDate,
        vendor: li.vendor,
        category: normalizeExpenseCategory(li.category),
        amount: Number(li.amount) || 0,
        payment_method: li.paymentMethod,
        business_purpose: li.businessPurpose || 'Liquidation expense',
        receipt_url: receiptUrl,
        or_number: li.orNumber,
      }),
    });
  }

  if (input.isDraft) return liquidation;
  return apiFetch(`/api/liquidations/${liquidation.id}/submit`, {
    method: 'POST',
    body: JSON.stringify({ refundMethod: input.refundMethod }),
  });
}

/**
 * Custodian: close out a Reviewed liquidation with a refund due, once the
 * cash has actually been collected back from the requestor.
 */
export const collectLiquidationRefund = (liquidationId: string, refundMethod: string, referenceNote?: string) =>
  apiFetch(`/api/liquidations/${liquidationId}/collect-refund`, {
    method: 'POST',
    body: JSON.stringify({ referenceNote, refundMethod }),
  });
