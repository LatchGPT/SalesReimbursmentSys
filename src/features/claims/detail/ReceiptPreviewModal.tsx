import { Modal } from '../../../components/shared/Modal';
import { Button } from '../../../components/ui/Button';
import { ExpenseLineItem } from '../../../types';
import { formatMoney } from '../../../lib/money';
import { uploadUrl } from '../../../lib/api';

export function ReceiptPreviewModal({
  receipt,
  onClose,
}: {
  receipt: ExpenseLineItem | null;
  onClose: () => void;
}) {
  if (!receipt) return null;

  const url = uploadUrl(receipt.receiptUrl);

  return (
    <Modal isOpen onClose={onClose} titleId="claim-receipt-title" className="max-w-lg">
      <div className="bg-surface-container-lowest rounded-xl w-full p-6 shadow-2xl space-y-4">
        <div className="flex justify-between items-center border-b border-outline-variant pb-3">
          <h3 id="claim-receipt-title" className="font-headline-sm text-on-surface">Receipt Attachment</h3>
          <button aria-label="Close receipt preview" onClick={onClose} className="text-outline hover:text-on-surface">
            <span aria-hidden="true" className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="p-4 bg-surface-container-low rounded-lg border border-outline-variant text-center">
          {(() => {
            if (!url) return null;
            if (url.startsWith('blob:') || url.startsWith('data:image') || url.match(/\.(jpeg|jpg|gif|png)($|\?)/i)) {
              return <img src={url} alt="Receipt preview" className="max-h-64 mx-auto object-contain rounded" />;
            }
            if (url.match(/\.pdf($|\?)/i)) {
              return <iframe title="Receipt attachment" src={url} className="w-full h-64 rounded border border-outline-variant" />;
            }
            return (
              <div className="py-8">
                <span className="material-symbols-outlined text-[56px] text-primary mb-2">description</span>
                <p className="font-bold text-on-surface">{receipt.receiptFileName || 'Receipt_Document.pdf'}</p>
              </div>
            );
          })()}
        </div>

        <div className="space-y-1 text-sm text-on-surface">
          <p><span className="text-outline">Vendor:</span> {receipt.vendor || 'N/A'}</p>
          <p><span className="text-outline">Category:</span> {receipt.category}</p>
          <p><span className="text-outline">Amount:</span> {formatMoney(receipt.amount)}</p>
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-outline-variant">
          {receipt.receiptUrl && (
            <a href={uploadUrl(receipt.receiptUrl)} target="_blank" rel="noreferrer" download={receipt.receiptFileName || 'receipt.pdf'}>
              <Button variant="outline" size="sm" className="gap-1">
                <span className="material-symbols-outlined text-[16px]">download</span> Download
              </Button>
            </a>
          )}
          <Button size="sm" onClick={onClose}>Close</Button>
        </div>
      </div>
    </Modal>
  );
}
