type ClaimType = 'Reimbursement' | 'Transport Reimbursement' | 'Cash Advance' | 'Liquidation';

const STATIC_CLAIM_TYPE_ENABLED: Record<ClaimType, boolean> = {
  Reimbursement: true,
  'Transport Reimbursement': true,
  'Cash Advance': false,
  Liquidation: false,
};

export function isClaimTypeEnabled(type: ClaimType): boolean {
  return process.env.ENABLE_ALL_CLAIM_TYPES === '1' || STATIC_CLAIM_TYPE_ENABLED[type] !== false;
}

export const COMING_SOON_MESSAGE =
  'This request type is coming soon. It isn\'t available to submit yet — please use General or Transport Reimbursement in the meantime.';
