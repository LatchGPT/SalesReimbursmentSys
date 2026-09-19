import { Card } from '../../../components/ui/Card';
import { formatMoney } from '../../../lib/money';
import { REIMBURSEMENT_CAP, useClaimWizard } from './useClaimWizard';

export function ReviewStep({ wizard }: { wizard: ReturnType<typeof useClaimWizard> }) {
  const {
    claimType,
    totalAmount,
    reimbursableAmount,
    approver,
    filingDate,
  } = wizard;

  return (
    <Card className="max-w-3xl mx-auto text-center py-12">
      <span className="material-symbols-outlined text-[48px] text-primary mb-4">fact_check</span>
      <h4 className="font-headline-md text-on-surface mb-2">Ready to Submit</h4>
      <p className="text-on-surface-variant mb-6">Review your {claimType} before submission.</p>
      <div className="bg-surface-container p-6 rounded-lg text-left inline-block w-full max-w-md">
        <div className="flex justify-between mb-2"><span className="text-on-surface-variant">Type:</span><span className="font-bold">{claimType}</span></div>
        <div className="flex justify-between mb-2"><span className="text-on-surface-variant">Claimed Amount:</span><span className="font-mono-data font-bold">{formatMoney(totalAmount)}</span></div>
        {(claimType === 'Reimbursement' || claimType === 'Transport Reimbursement') && (
          <div className="flex justify-between mb-2">
            <span className="text-on-surface-variant">Maximum Reimbursable:</span>
            <span className="font-mono-data font-bold text-primary">{formatMoney(reimbursableAmount)}</span>
          </div>
        )}
        <div className="flex justify-between mb-2"><span className="text-on-surface-variant">Date Filed:</span><span className="font-mono-data font-bold">{filingDate}</span></div>
        <div className="flex justify-between"><span className="text-on-surface-variant">Approver:</span><span className="font-bold">{approver?.name || 'Assigned Approver'}</span></div>
        {totalAmount > REIMBURSEMENT_CAP && (claimType === 'Reimbursement' || claimType === 'Transport Reimbursement') && (
          <p className="text-body-sm text-tertiary mt-4 pt-4 border-t border-outline-variant">
            You may file the full amount, but current policy limits reimbursement to {formatMoney(REIMBURSEMENT_CAP)} per claim.
          </p>
        )}
      </div>
    </Card>
  );
}
