import { Dispatch, SetStateAction } from 'react';
import { Modal } from '../../../components/shared/Modal';
import { Button } from '../../../components/ui/Button';
import { Claim, StatusHistory } from '../../../types';
import { DraftLineItem } from '../../../lib/api';

export function ReviseClaimModal({
  isOpen,
  onClose,
  claim,
  history,
  reviseLineItems,
  setReviseLineItems,
  submittingRevision,
  onResubmit,
}: {
  isOpen: boolean;
  onClose: () => void;
  claim: Claim;
  history: StatusHistory[];
  reviseLineItems: DraftLineItem[];
  setReviseLineItems: Dispatch<SetStateAction<DraftLineItem[]>>;
  submittingRevision: boolean;
  onResubmit: () => void;
}) {
  if (!isOpen) return null;

  return (
    <Modal isOpen onClose={onClose} titleId="revise-claim-title" className="max-w-3xl">
      <div className="bg-surface-container-lowest rounded-xl w-full p-6 shadow-2xl space-y-4">
        <div className="flex justify-between items-center border-b border-outline-variant pb-3">
          <h3 id="revise-claim-title" className="font-headline-sm text-on-surface">Revise &amp; Resubmit {claim.ref}</h3>
          <button aria-label="Close claim revision" onClick={onClose} className="text-outline hover:text-on-surface">
            <span aria-hidden="true" className="material-symbols-outlined">close</span>
          </button>
        </div>

        {history[0]?.comment && (
          <div className="p-3 bg-error-container/20 border border-error/20 rounded-lg">
            <p className="text-body-sm font-medium text-error mb-1">Approver's note:</p>
            <p className="text-body-sm text-on-surface-variant italic">"{history[0].comment}"</p>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[700px]">
            <thead className="bg-brand-table-header text-on-surface-variant font-label-sm uppercase tracking-wider">
              <tr>
                <th className="px-3 py-2">Category</th>
                <th className="px-3 py-2">Vendor</th>
                <th className="px-3 py-2">Purpose</th>
                <th className="px-3 py-2 text-right">Amount</th>
                <th className="px-3 py-2">Receipt</th>
                <th className="px-3 py-2 w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-border">
              {reviseLineItems.map((item, idx) => (
                <tr key={idx}>
                  <td className="px-3 py-2">
                    <select
                      className="w-full py-1 px-2 text-xs border border-outline-variant rounded"
                      value={item.category || ''}
                      onChange={e => setReviseLineItems(p => p.map((li, i) => i === idx ? { ...li, category: e.target.value } : li))}
                    >
                      <option value="">Select Category</option>
                      <option>Meals</option>
                      <option>Supplies</option>
                      <option>Lodging</option>
                      <option>Transportation</option>
                      <option>Utilities</option>
                      <option>Entertainment</option>
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <input
                      className="w-full py-1 px-2 text-xs border border-outline-variant rounded"
                      value={item.vendor || ''}
                      onChange={e => setReviseLineItems(p => p.map((li, i) => i === idx ? { ...li, vendor: e.target.value } : li))}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      className="w-full py-1 px-2 text-xs border border-outline-variant rounded"
                      value={item.businessPurpose || ''}
                      onChange={e => setReviseLineItems(p => p.map((li, i) => i === idx ? { ...li, businessPurpose: e.target.value } : li))}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      className="w-full py-1 px-2 text-xs text-right font-mono-data border border-outline-variant rounded"
                      value={item.amount || ''}
                      onChange={e => setReviseLineItems(p => p.map((li, i) => i === idx ? { ...li, amount: Number(e.target.value) } : li))}
                    />
                  </td>
                  <td className="px-3 py-2">
                    {item.receiptFile ? (
                      <span className="text-xs text-primary truncate max-w-[100px] inline-block">{item.receiptFile.name}</span>
                    ) : item.receiptUrl ? (
                      <span className="text-xs text-outline">Existing receipt</span>
                    ) : (
                      <span className="text-xs text-error">No receipt</span>
                    )}
                    <label className="ml-2 cursor-pointer text-xs text-primary hover:underline">
                      {item.receiptUrl || item.receiptFile ? 'Replace' : 'Attach'}
                      <input
                        type="file"
                        accept="image/*,.pdf"
                        className="hidden"
                        onChange={e => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          setReviseLineItems(p => p.map((li, i) => i === idx ? { ...li, receiptFile: file, receiptUrl: URL.createObjectURL(file) } : li));
                        }}
                      />
                    </label>
                  </td>
                  <td className="px-3 py-2">
                    <button onClick={() => setReviseLineItems(p => p.filter((_, i) => i !== idx))} className="text-error hover:opacity-70">
                      <span className="material-symbols-outlined text-[18px]">delete_outline</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <Button
          size="sm"
          variant="outline"
          className="gap-2"
          onClick={() => setReviseLineItems(p => [...p, { expenseDate: new Date().toISOString().split('T')[0], amount: 0, paymentMethod: 'Personal Card', vendor: '', category: 'Meals' }])}
        >
          <span className="material-symbols-outlined text-[16px]">add</span> Add Row
        </Button>

        <div className="flex justify-end gap-2 pt-2 border-t border-outline-variant">
          <Button variant="ghost" onClick={onClose} disabled={submittingRevision}>Cancel</Button>
          <Button className="gap-2" onClick={onResubmit} disabled={submittingRevision}>
            {submittingRevision ? <span className="material-symbols-outlined animate-spin text-[18px]">sync</span> : null}
            Resubmit for Approval
          </Button>
        </div>
      </div>
    </Modal>
  );
}
