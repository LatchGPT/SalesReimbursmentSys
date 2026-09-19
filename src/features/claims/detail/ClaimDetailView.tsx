import { useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '../../../components/ui/Button';
import { Card, CardContent } from '../../../components/ui/Card';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import { ApproverActionButtons } from '@/features/approvals';
import { CustodianActionButtons } from '@/features/disbursements';
import { useAppContext } from '../../../components/AppContext';
import { useToast } from '../../../components/shared/ToastContext';
import { confirmReceipt, resubmitClaimFlow, DraftLineItem } from '../../../lib/api';
import { UserRole, ClaimStatus, ExpenseLineItem } from '../../../types';
import { isCustodianProcessingClaim } from '../../../lib/claimWorkflow';
import { exportClaimPdf, exportClaimWord } from '../../../lib/claimExport';
import { ReceiptPreviewModal } from './ReceiptPreviewModal';
import { ConfirmReceiptModal } from './ConfirmReceiptModal';
import { ReviseClaimModal } from './ReviseClaimModal';
import { ClaimSummaryCard } from './ClaimSummaryCard';
import { ClaimLineItemsTable } from './ClaimLineItemsTable';
import { ClaimMomSection } from './ClaimMomSection';
import { ClaimTimeline } from './ClaimTimeline';

export function ClaimDetailView() {
  const { addToast } = useToast();
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentUser, claims, lineItems, moms, users, statusHistory, fieldDefinitions, refresh } = useAppContext();
  const [activeReceipt, setActiveReceipt] = useState<ExpenseLineItem | null>(null);
  const [confirmingReceipt, setConfirmingReceipt] = useState(false);
  const [receiptCode, setReceiptCode] = useState('');
  const [receiptError, setReceiptError] = useState('');
  const receiptCodeRef = useRef<HTMLInputElement>(null);
  const [submittingReceipt, setSubmittingReceipt] = useState(false);
  const [revising, setRevising] = useState(false);
  const [reviseLineItems, setReviseLineItems] = useState<DraftLineItem[]>([]);
  const [submittingRevision, setSubmittingRevision] = useState(false);
  const [exporting, setExporting] = useState<'pdf' | 'word' | null>(null);

  const claim = claims.find(c => c.id === id) || claims[0];
  const items = lineItems.filter(li => li.claimId === claim.id);
  const mom = moms.find(m => m.claimId === claim.id);
  const history = statusHistory
    .filter(h => h.claimId === claim.id)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  const requestorName = users.find(user => user.id === claim.requestorId)?.name || 'Unknown requestor';

  const handleExport = async (format: 'pdf' | 'word') => {
    setExporting(format);
    try {
      if (format === 'pdf') {
        await exportClaimPdf(claim, items, mom, requestorName);
      } else {
        exportClaimWord(claim, items, mom, requestorName);
      }
      addToast(`Claim exported as ${format === 'pdf' ? 'PDF' : 'Word'}.`, 'success');
    } catch (error: any) {
      addToast(error?.message || 'Could not export this claim.', 'error');
    } finally {
      setExporting(null);
    }
  };

  const isApprover = currentUser.role === UserRole.APPROVER &&
    (claim.status === ClaimStatus.PENDING_APPROVAL || claim.status === ClaimStatus.SUBMITTED) &&
    currentUser.id !== claim.requestorId;

  const isCustodian = currentUser.role === UserRole.CUSTODIAN && isCustodianProcessingClaim(claim);
  const canConfirmReceipt = currentUser.id === claim.requestorId && claim.status === ClaimStatus.READY_FOR_CLAIM;
  const canResubmit = currentUser.id === claim.requestorId &&
    claim.status === ClaimStatus.RETURNED &&
    (claim.type === 'Reimbursement' || claim.type === 'Transport Reimbursement');

  const openRevise = () => {
    setReviseLineItems(items.map(li => ({
      category: li.category,
      amount: li.amount,
      vendor: li.vendor,
      businessPurpose: li.businessPurpose,
      expenseDate: li.expenseDate,
      paymentMethod: li.paymentMethod,
      receiptUrl: li.receiptUrl,
      orNumber: li.orNumber,
    })));
    setRevising(true);
  };

  const handleResubmit = async () => {
    if (reviseLineItems.length === 0) {
      addToast('Add at least one expense line item.', 'error');
      return;
    }
    if (claim.type === 'Reimbursement' && !mom) {
      addToast('This claim has no Minutes of Meeting to resubmit against.', 'error');
      return;
    }
    setSubmittingRevision(true);
    try {
      await resubmitClaimFlow({
        claimId: claim.id,
        momId: mom?.id,
        claimType: claim.type === 'Transport Reimbursement' ? 'Transport Reimbursement' : 'Reimbursement',
        lineItems: reviseLineItems,
        remarks: claim.purpose,
      });
      await refresh();
      addToast('Claim revised and resubmitted for approval.', 'success');
      setRevising(false);
    } catch (err: any) {
      addToast(err?.message || 'Could not resubmit the claim.', 'error');
    } finally {
      setSubmittingRevision(false);
    }
  };

  const handleConfirmReceipt = async () => {
    if (!receiptCode.trim()) {
      setReceiptError('Enter the release code from your custodian.');
      return;
    }
    setSubmittingReceipt(true);
    setReceiptError('');
    try {
      await confirmReceipt(claim.id, receiptCode.trim());
      await refresh();
      addToast('Receipt confirmed. Your reimbursement is complete.', 'success');
      setConfirmingReceipt(false);
      setReceiptCode('');
    } catch (err: any) {
      setReceiptError(err?.message || 'Could not confirm receipt.');
    } finally {
      setSubmittingReceipt(false);
    }
  };

  return (
    <div className="flex flex-col gap-8 animate-in fade-in duration-500 pb-12">
      <div className="flex flex-col lg:flex-row lg:justify-between lg:items-start gap-4">
        <div className="min-w-0">
          <nav className="flex gap-2 text-on-surface-variant font-label-sm mb-2">
            <span className="cursor-pointer hover:text-primary" onClick={() => navigate(-1)}>Claims</span>
            <span>/</span>
            <span className="text-on-surface font-semibold">{claim.ref}</span>
          </nav>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-display text-display text-on-surface break-words">{claim.purpose}</h1>
            <StatusBadge status={claim.status} />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <Button variant="outline" className="gap-2" onClick={() => handleExport('pdf')} disabled={exporting !== null}>
            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">picture_as_pdf</span>
            {exporting === 'pdf' ? 'Exporting…' : 'Export PDF'}
          </Button>
          <Button variant="outline" className="gap-2" onClick={() => handleExport('word')} disabled={exporting !== null}>
            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">description</span>
            Export Word
          </Button>
          {isApprover && <ApproverActionButtons claim={claim} size="md" />}
          {isCustodian && <CustodianActionButtons claim={claim} size="md" />}
          {canConfirmReceipt && (
            <Button className="gap-2" onClick={() => { setReceiptCode(''); setReceiptError(''); setConfirmingReceipt(true); }}>
              <span className="material-symbols-outlined text-[18px]">check_circle</span> Confirm Receipt
            </Button>
          )}
          {canResubmit && (
            <Button className="gap-2" onClick={openRevise}>
              <span className="material-symbols-outlined text-[18px]">edit_note</span> Revise &amp; Resubmit
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="col-span-12 lg:col-span-8 flex flex-col gap-8">
          <ClaimSummaryCard claim={claim} fieldDefinitions={fieldDefinitions} />
          <ClaimLineItemsTable claim={claim} items={items} onSelectReceipt={setActiveReceipt} />
          {mom && <ClaimMomSection mom={mom} claim={claim} />}
        </div>

        <div className="col-span-12 lg:col-span-4 flex flex-col gap-8">
          {canConfirmReceipt && claim.releaseCode && (
            <Card className="border-primary/30 bg-primary-container/20">
              <CardContent className="p-6">
                <div className="flex items-center gap-2 mb-2">
                  <span className="material-symbols-outlined text-primary">key</span>
                  <h3 className="font-headline-md text-on-surface">Ready for Release</h3>
                </div>
                <p className="text-body-sm text-on-surface-variant mb-4">
                  The custodian has released your payout. Enter the release code they gave you
                  (in person or by message) to confirm receipt and complete this claim.
                </p>
                <Button className="w-full gap-2" onClick={() => { setReceiptCode(''); setReceiptError(''); setConfirmingReceipt(true); }}>
                  <span className="material-symbols-outlined text-[18px]">check_circle</span> Enter Code to Confirm
                </Button>
              </CardContent>
            </Card>
          )}

          <ClaimTimeline history={history} users={users} />
        </div>
      </div>

      <ReceiptPreviewModal receipt={activeReceipt} onClose={() => setActiveReceipt(null)} />

      <ConfirmReceiptModal
        isOpen={confirmingReceipt}
        onClose={() => setConfirmingReceipt(false)}
        claim={claim}
        receiptCode={receiptCode}
        setReceiptCode={setReceiptCode}
        receiptError={receiptError}
        setReceiptError={setReceiptError}
        receiptCodeRef={receiptCodeRef}
        submittingReceipt={submittingReceipt}
        onConfirm={handleConfirmReceipt}
      />

      <ReviseClaimModal
        isOpen={revising}
        onClose={() => setRevising(false)}
        claim={claim}
        history={history}
        reviseLineItems={reviseLineItems}
        setReviseLineItems={setReviseLineItems}
        submittingRevision={submittingRevision}
        onResubmit={handleResubmit}
      />
    </div>
  );
}
