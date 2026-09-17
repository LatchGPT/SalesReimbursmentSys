import { RefObject } from 'react';
import { Modal } from '../../../components/shared/Modal';
import { Button } from '../../../components/ui/Button';
import { Claim } from '../../../types';
import { formatMoney } from '../../../lib/money';

export function ConfirmReceiptModal({
  isOpen,
  onClose,
  claim,
  receiptCode,
  setReceiptCode,
  receiptError,
  setReceiptError,
  receiptCodeRef,
  submittingReceipt,
  onConfirm,
}: {
  isOpen: boolean;
  onClose: () => void;
  claim: Claim;
  receiptCode: string;
  setReceiptCode: (val: string) => void;
  receiptError: string;
  setReceiptError: (val: string) => void;
  receiptCodeRef: RefObject<HTMLInputElement | null>;
  submittingReceipt: boolean;
  onConfirm: () => void;
}) {
  if (!isOpen) return null;

  return (
    <Modal
      isOpen
      onClose={onClose}
      titleId="confirm-receipt-title"
      initialFocusRef={receiptCodeRef}
      className="max-w-md"
    >
      <div className="bg-surface-container-lowest rounded-xl w-full p-6 shadow-2xl space-y-4">
        <div className="flex justify-between items-center border-b border-outline-variant pb-3">
          <h3 id="confirm-receipt-title" className="font-headline-sm text-on-surface">Confirm Receipt of Funds</h3>
          <button aria-label="Close receipt confirmation" onClick={onClose} className="text-outline hover:text-on-surface">
            <span aria-hidden="true" className="material-symbols-outlined">close</span>
          </button>
        </div>

        <p className="text-body-sm text-on-surface-variant">
          Enter the release code provided by your custodian to confirm you received the
          payout for <span className="font-semibold text-on-surface">{claim.ref}</span> ({formatMoney(claim.paidAmount || claim.approvedAmount || Math.min(claim.total, 1000))}).
          This completes your reimbursement.
        </p>

        <div>
          <input
            ref={receiptCodeRef}
            aria-label="Release code"
            aria-invalid={Boolean(receiptError)}
            aria-describedby={receiptError ? 'receipt-code-error' : undefined}
            value={receiptCode}
            onChange={e => { setReceiptCode(e.target.value); setReceiptError(''); }}
            onKeyDown={e => { if (e.key === 'Enter') onConfirm(); }}
            placeholder="Release code"
            className={`w-full bg-white border ${receiptError ? 'border-error' : 'border-brand-field-border'} rounded-input px-4 py-2.5 font-mono-data tracking-widest text-body-base focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none uppercase`}
          />
          {receiptError && <p id="receipt-code-error" role="alert" className="text-error text-xs mt-1">{receiptError}</p>}
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-outline-variant">
          <Button variant="ghost" onClick={onClose} disabled={submittingReceipt}>Cancel</Button>
          <Button className="gap-2" onClick={onConfirm} disabled={submittingReceipt}>
            {submittingReceipt ? <span className="material-symbols-outlined animate-spin text-[18px]">sync</span> : null}
            Confirm &amp; Complete
          </Button>
        </div>
      </div>
    </Modal>
  );
}
