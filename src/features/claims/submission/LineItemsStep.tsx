import { useState } from 'react';
import { Button, cn } from '../../../components/ui/Button';
import { Input, Select, Label } from '../../../components/ui/Input';
import { Card, CardHeader, CardContent } from '../../../components/ui/Card';
import { DynamicFieldRenderer } from '@/features/admin';
import { EXPENSE_CATEGORIES } from '../../../lib/expenseCategories';
import { formatMoney } from '../../../lib/money';
import {
  getReimbursementDateError,
  validateReimbursementPurchaseDate,
} from '../domain/reimbursementPolicy';
import { useClaimWizard } from './useClaimWizard';
import { ReceiptAttachmentPreviewModal } from '../detail/ReceiptAttachmentPreviewModal';

export function LineItemsStep({ wizard }: { wizard: ReturnType<typeof useClaimWizard> }) {
  const [previewReceipt, setPreviewReceipt] = useState<{ url: string; fileName?: string; fileType?: string } | null>(null);
  const {
    claimType,
    lineItemsLocal,
    setLineItemsLocal,
    liquidationBlocked,
    myCashAdvances,
    cashAdvanceId,
    setCashAdvanceId,
    cashAdvanceAmount,
    setCashAdvanceAmount,
    cashAdvancePurpose,
    setCashAdvancePurpose,
    claimCustomFields,
    setClaimCustomFields,
    claimErrors,
    setClaimErrors,
    isReimbursement,
    earliestEligiblePurchaseDate,
    filingDate,
    dateValidationAttempted,
    invalidDateInputRefs,
    handleFileUploadForLineItem,
    claims,
    varianceAmount,
    varianceType,
    refundMethod,
    setRefundMethod,
    paymentMethods,
    totalAmount,
  } = wizard;

  return (
    <Card>
      <CardHeader>
        <h3 className="font-headline-md text-on-surface">{claimType} Details</h3>
        <div className="flex items-center gap-2">
          {claimType !== 'Cash Advance' && !liquidationBlocked && (
            <Button
              size="sm"
              className="gap-2"
              onClick={() => setLineItemsLocal(p => [...p, {
                expenseDate: '',
                amount: 0,
                paymentMethod: 'Personal Card',
                vendor: '',
                category: claimType === 'Transport Reimbursement' ? 'Transportation' : 'Meals',
              }])}
            >
              <span className="material-symbols-outlined text-[18px]">add</span> Add Row
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {claimType === 'Liquidation' && (
          myCashAdvances.length === 0 ? (
            <div className="mb-6 p-6 rounded-lg border border-outline-variant bg-surface-container-low text-center">
              <span className="material-symbols-outlined text-[36px] text-outline mb-2">check_circle</span>
              <p className="font-label-md text-on-surface mb-1">No cash advances to liquidate</p>
              <p className="text-body-sm text-outline">
                You have no released cash advances awaiting liquidation. Any advance you've already
                started liquidating won't appear here.
              </p>
            </div>
          ) : (
            <div className="mb-6 max-w-md">
              <Label required>Select Cash Advance to Liquidate</Label>
              <Select value={cashAdvanceId} onChange={e => setCashAdvanceId(e.target.value)}>
                <option value="">-- Select --</option>
                {myCashAdvances.map(ca => <option key={ca.id} value={ca.id}>{ca.ref} - {formatMoney(ca.total)} ({ca.purpose})</option>)}
              </Select>
            </div>
          )
        )}

        {claimType === 'Cash Advance' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl mb-6">
            <div>
              <Label required>Requested Amount</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-outline-variant">₱</span>
                <Input type="number" value={cashAdvanceAmount || ''} onChange={e => setCashAdvanceAmount(Number(e.target.value))} className="pl-6" />
              </div>
            </div>
            <div>
              <Label required>Purpose</Label>
              <Input value={cashAdvancePurpose} onChange={e => setCashAdvancePurpose(e.target.value)} placeholder="What is this advance for?" />
            </div>
          </div>
        )}

        {claimType !== 'Cash Advance' && !liquidationBlocked && (
          <div className="mb-6">
            <DynamicFieldRenderer
              entity="claim"
              claimType={claimType}
              values={claimCustomFields}
              onChange={(key, value) => {
                setClaimCustomFields(p => ({ ...p, [key]: value }));
                if (claimErrors[key] || (key.endsWith('_other') && claimErrors[key.replace('_other', '')])) {
                  setClaimErrors(p => {
                    const next = { ...p };
                    delete next[key];
                    if (key.endsWith('_other')) delete next[key.replace('_other', '')];
                    return next;
                  });
                }
              }}
              errors={claimErrors}
            />
          </div>
        )}

        {claimType !== 'Cash Advance' && !liquidationBlocked && (
          <div className="overflow-x-auto">
            {isReimbursement && (
              <div className="mb-4 flex items-start gap-3 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3">
                <span className="material-symbols-outlined text-primary text-[20px]">event_available</span>
                <div>
                  <p className="text-sm font-semibold text-on-surface">30-day filing window</p>
                  <p className="text-xs text-on-surface-variant mt-0.5">
                    Receipt purchases must be dated from {earliestEligiblePurchaseDate} through {filingDate}. Older receipts cannot proceed to review.
                  </p>
                </div>
              </div>
            )}
            <table className="w-full text-left min-w-[1080px]">
              <thead className="bg-brand-table-header text-on-surface-variant font-label-sm uppercase tracking-wider">
                <tr>
                  <th className="px-3 py-3 sticky left-0 bg-brand-table-header z-20 shadow-[1px_0_0_var(--color-brand-border)]">Date of Purchase</th>
                  <th className="px-3 py-3">Category</th>
                  <th className="px-3 py-3">Vendor / Supplier</th>
                  <th className="px-3 py-3">Payment Method</th>
                  <th className="px-3 py-3">Purpose</th>
                  <th className="px-3 py-3">OR Number</th>
                  <th className="px-3 py-3 text-right">Amount</th>
                  <th className="px-3 py-3">Receipt / OR Attachment</th>
                  <th className="px-3 py-3 w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-border">
                {lineItemsLocal.map((item, idx) => (
                  <tr key={idx} className="hover:bg-brand-row-hover transition-colors group">
                    <td className="px-3 py-3 sticky left-0 bg-white z-10 shadow-[1px_0_0_var(--color-brand-border)] group-hover:bg-brand-row-hover">
                      <Input
                        ref={element => { invalidDateInputRefs.current[idx] = element; }}
                        id={`expense-date-${idx}`}
                        type="date"
                        value={item.expenseDate || ''}
                        max={isReimbursement ? filingDate : undefined}
                        aria-invalid={dateValidationAttempted && isReimbursement && !validateReimbursementPurchaseDate(item.expenseDate, filingDate).valid}
                        aria-describedby={
                          dateValidationAttempted && isReimbursement && getReimbursementDateError(item.expenseDate, filingDate)
                            ? `expense-date-error-${idx}`
                            : undefined
                        }
                        onChange={e => setLineItemsLocal(prev => prev.map((li, i) => i === idx ? { ...li, expenseDate: e.target.value } : li))}
                        className={cn(
                          "py-1 px-2 text-xs",
                          dateValidationAttempted && isReimbursement && !validateReimbursementPurchaseDate(item.expenseDate, filingDate).valid && "border-error focus:ring-error",
                        )}
                      />
                      {dateValidationAttempted && isReimbursement && getReimbursementDateError(item.expenseDate, filingDate) && (
                        <p id={`expense-date-error-${idx}`} className="text-error text-[11px] mt-1 max-w-[190px] flex items-start gap-1">
                          <span aria-hidden="true" className="material-symbols-outlined text-[13px] mt-px">error</span>
                          {getReimbursementDateError(item.expenseDate, filingDate)}
                        </p>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <Select disabled={claimType === 'Transport Reimbursement'} className="py-1 pl-2 pr-8 text-xs" value={item.category || ''} onChange={e => setLineItemsLocal(prev => prev.map((li, i) => i === idx ? { ...li, category: e.target.value } : li))}>
                        <option value="">Select Category</option>
                        {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                      </Select>
                    </td>
                    <td className="px-3 py-3">
                      <Input type="text" value={item.vendor || ''} onChange={e => setLineItemsLocal(prev => prev.map((li, i) => i === idx ? { ...li, vendor: e.target.value } : li))} className="py-1 px-2 text-xs" placeholder="Vendor..." />
                    </td>
                    <td className="px-3 py-3">
                      <Select className="py-1 pl-2 pr-8 text-xs" value={item.paymentMethod || 'Personal Card'} onChange={e => setLineItemsLocal(prev => prev.map((li, i) => i === idx ? { ...li, paymentMethod: e.target.value } : li))}>
                        <option>Personal Card</option>
                        <option>Company Card</option>
                        <option>Cash</option>
                        <option>Bank Transfer</option>
                      </Select>
                    </td>
                    <td className="px-3 py-3">
                      <Input type="text" value={item.businessPurpose || ''} onChange={e => setLineItemsLocal(prev => prev.map((li, i) => i === idx ? { ...li, businessPurpose: e.target.value } : li))} className="py-1 px-2 text-xs" placeholder="Purpose..." />
                    </td>
                    <td className="px-3 py-3">
                      <Input
                        type="text"
                        value={item.orNumber || ''}
                        onChange={e => setLineItemsLocal(prev => prev.map((li, i) => i === idx ? { ...li, orNumber: e.target.value } : li))}
                        className="py-1 px-2 text-xs"
                        placeholder="Official receipt no."
                      />
                    </td>
                    <td className="px-3 py-3">
                      <div className="relative">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-outline-variant text-xs">₱</span>
                        <Input type="number" value={item.amount || ''} onChange={e => setLineItemsLocal(prev => prev.map((li, i) => i === idx ? { ...li, amount: Number(e.target.value) } : li))} className="pl-5 py-1 px-2 text-right font-mono-data text-xs" />
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        {item.receiptFile ? (
                          <div className="flex items-center gap-1">
                            <div className="flex items-center gap-1 bg-surface-container px-2 py-1 rounded text-xs">
                              <span className="material-symbols-outlined text-[14px] text-primary">description</span>
                              <span className="truncate max-w-[100px]">{item.receiptFile.name}</span>
                              <button type="button" aria-label={`Remove ${item.receiptFile.name}`} onClick={() => setLineItemsLocal(prev => prev.map((li, i) =>
                                i === idx ? { ...li, receiptFile: undefined, receiptUrl: undefined } : li
                              ))} className="text-error hover:opacity-80">
                                <span className="material-symbols-outlined text-[14px]">close</span>
                              </button>
                            </div>
                            {item.receiptUrl && (
                              <button
                                type="button"
                                className="text-xs font-semibold text-primary hover:underline"
                                onClick={() => setPreviewReceipt({ url: item.receiptUrl!, fileName: item.receiptFile?.name, fileType: item.receiptFile?.type })}
                              >
                                View Receipt
                              </button>
                            )}
                          </div>
                        ) : item.receiptUrl ? (
                          <button
                            type="button"
                            className="text-xs font-semibold text-primary hover:underline"
                            onClick={() => setPreviewReceipt({ url: item.receiptUrl! })}
                          >
                            View Receipt
                          </button>
                        ) : (
                          <label className="cursor-pointer inline-flex items-center gap-1 text-xs text-primary font-semibold hover:underline">
                            <span className="material-symbols-outlined text-[16px]">upload_file</span> Attach OR/Receipt
                            <input type="file" accept="image/*,.pdf" className="hidden" onChange={e => handleFileUploadForLineItem(idx, e)} />
                          </label>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <button onClick={() => setLineItemsLocal(p => p.filter((_, i) => i !== idx))} className="text-error hover:opacity-70"><span className="material-symbols-outlined">delete_outline</span></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!liquidationBlocked && (
          <div className="mt-6 flex justify-end gap-8 bg-surface-container-low p-6 rounded-lg">
            {claimType !== 'Cash Advance' && (
              <div className="text-right">
                <span className="font-label-sm text-on-surface-variant uppercase">Total Items</span>
                <p className="font-headline-md">{lineItemsLocal.length}</p>
              </div>
            )}
            {claimType === 'Liquidation' && cashAdvanceId && (
              <div className="text-right">
                <span className="font-label-sm text-on-surface-variant uppercase">Advance</span>
                <p className="font-headline-md">{formatMoney(claims.find((c: any) => c.id === cashAdvanceId)?.total || 0)}</p>
              </div>
            )}
            <div className="text-right bg-primary-container text-on-primary-container px-6 py-3 rounded-lg">
              <span className="font-label-sm uppercase opacity-80">{claimType === 'Liquidation' ? varianceType : 'Total Amount'}</span>
              <p className="text-[28px] font-bold leading-none mt-1">{formatMoney(claimType === 'Liquidation' ? Math.abs(varianceAmount) : totalAmount)}</p>
            </div>
          </div>
        )}

        {claimType === 'Liquidation' && varianceType === 'RefundDue' && (
          <div className="mt-4 p-5 rounded-lg border border-tertiary/40 bg-tertiary-container/20">
            <div className="flex items-start gap-3">
              <span className="material-symbols-outlined text-tertiary mt-0.5">undo</span>
              <div className="flex-1">
                <p className="font-label-md text-on-surface">
                  You need to return {formatMoney(Math.abs(varianceAmount))} to the company.
                </p>
                <p className="text-body-sm text-outline mt-0.5 mb-3">
                  How will you pay this refund back? The custodian confirms it when they collect.
                </p>
                <div className="max-w-xs">
                  <label className="block text-label-sm text-on-surface mb-1">Refund Method <span className="text-error">*</span></label>
                  <Select value={refundMethod} onChange={e => setRefundMethod(e.target.value)}>
                    <option value="">Select how you'll refund…</option>
                    {paymentMethods.map(m => <option key={m} value={m}>{m}</option>)}
                  </Select>
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
      <ReceiptAttachmentPreviewModal
        url={previewReceipt?.url || null}
        fileName={previewReceipt?.fileName}
        fileType={previewReceipt?.fileType}
        onClose={() => setPreviewReceipt(null)}
      />
    </Card>
  );
}
