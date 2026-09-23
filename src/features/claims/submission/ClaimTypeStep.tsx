import { Card, CardContent } from '../../../components/ui/Card';
import { ConfirmModal } from '../../../components/shared/ConfirmModal';
import { isClaimTypeEnabled, COMING_SOON_MESSAGE } from '../../../lib/featureFlags';
import { useClaimWizard } from './useClaimWizard';

export function ClaimTypeStep({ wizard }: { wizard: ReturnType<typeof useClaimWizard> }) {
  const {
    navigate,
    requestLeave,
    reimbursementIntent,
    setClaimType,
    setStep,
    setLineItemsLocal,
    comingSoonType,
    setComingSoonType,
  } = wizard;

  return (
    <div className="max-w-[800px] mx-auto py-12 px-6">
      <button
        type="button"
        className="inline-flex items-center gap-1 text-sm font-semibold text-on-surface-variant hover:text-primary mb-6"
        onClick={() => requestLeave(() => navigate(-1))}
      >
        <span className="material-symbols-outlined text-[18px]">arrow_back</span>
        Back
      </button>
      <div className="mb-8">
        <span className="font-label-sm text-primary font-bold uppercase tracking-wider">
          {reimbursementIntent ? 'New reimbursement' : 'New request'}
        </span>
        <h2 className="font-display text-display text-on-surface mt-1">
          {reimbursementIntent ? 'What are you claiming?' : 'What would you like to submit?'}
        </h2>
        <p className="text-body-md text-outline mt-2">
          {reimbursementIntent
            ? 'Choose the option that matches the expense. We will tailor the form and requirements for you.'
            : 'Choose a request type to start the correct workflow.'}
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <Card
          role="button"
          tabIndex={0}
          aria-label="Start a general reimbursement"
          className="group h-full border-2 hover:border-primary hover:shadow-lg cursor-pointer transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          onClick={() => { setClaimType('Reimbursement'); setStep(2); }}
          onKeyDown={event => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              setClaimType('Reimbursement');
              setStep(2);
            }
          }}
        >
          <CardContent className="p-7">
            <div className="w-12 h-12 rounded-xl bg-primary-container/30 text-primary flex items-center justify-center mb-5">
              <span className="material-symbols-outlined text-[28px]">receipt_long</span>
            </div>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="font-headline-sm">General Reimbursement</h3>
                <p className="text-sm text-on-surface-variant mt-2">Meals, accommodation, supplies, and other business expenses.</p>
              </div>
              <span className="material-symbols-outlined text-outline group-hover:text-primary group-hover:translate-x-1 transition-all">arrow_forward</span>
            </div>
            <p className="text-xs text-outline mt-5 pt-4 border-t border-outline-variant">Includes meeting details and supporting minutes.</p>
          </CardContent>
        </Card>
        <Card
          role="button"
          tabIndex={0}
          aria-label="Start a transport reimbursement"
          className="group h-full border-2 hover:border-primary hover:shadow-lg cursor-pointer transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          onClick={() => {
            setClaimType('Transport Reimbursement');
            setLineItemsLocal([{ expenseDate: '', amount: 0, paymentMethod: 'Personal Card', vendor: '', category: 'Transportation' }]);
            setStep(1);
          }}
          onKeyDown={event => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              setClaimType('Transport Reimbursement');
              setLineItemsLocal([{ expenseDate: '', amount: 0, paymentMethod: 'Personal Card', vendor: '', category: 'Transportation' }]);
              setStep(1);
            }
          }}
        >
          <CardContent className="p-7">
            <div className="w-12 h-12 rounded-xl bg-secondary-container/60 text-on-secondary-container flex items-center justify-center mb-5">
              <span className="material-symbols-outlined text-[28px]">local_taxi</span>
            </div>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="font-headline-sm">Transport Reimbursement</h3>
                <p className="text-sm text-on-surface-variant mt-2">Fares, mileage, tolls, parking, and other business transport.</p>
              </div>
              <span className="material-symbols-outlined text-outline group-hover:text-primary group-hover:translate-x-1 transition-all">arrow_forward</span>
            </div>
            <p className="text-xs text-outline mt-5 pt-4 border-t border-outline-variant">A faster receipt-based flow with no meeting minutes required.</p>
          </CardContent>
        </Card>
        {!reimbursementIntent && (() => {
          const enabled = isClaimTypeEnabled('Cash Advance');
          const open = () => { if (enabled) { setClaimType('Cash Advance'); setStep(1); } else { setComingSoonType('Cash Advance'); } };
          return (
            <Card
              role="button"
              tabIndex={0}
              aria-label={enabled ? 'Start a cash advance request' : 'Cash Advance — coming soon'}
              aria-disabled={!enabled}
              className={`group h-full border-2 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${enabled ? 'hover:border-primary hover:shadow-lg cursor-pointer' : 'cursor-not-allowed opacity-70'}`}
              onClick={open}
              onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); open(); } }}
            >
              <CardContent className="p-7">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-5 ${enabled ? 'bg-primary-container/30 text-primary' : 'bg-surface-container-high text-outline'}`}>
                  <span className="material-symbols-outlined text-[28px]">payments</span>
                </div>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-headline-sm">Cash Advance</h3>
                      {!enabled && <span className="inline-flex items-center rounded-full bg-tertiary-container/60 text-on-tertiary-container px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide">Coming soon</span>}
                    </div>
                    <p className="text-sm text-on-surface-variant mt-2">Request company funds before an upcoming business expense.</p>
                  </div>
                  {enabled && <span className="material-symbols-outlined text-outline group-hover:text-primary group-hover:translate-x-1 transition-all">arrow_forward</span>}
                </div>
                <p className="text-xs text-outline mt-5 pt-4 border-t border-outline-variant">
                  {enabled ? 'The released amount must be liquidated after the expense.' : 'Not available to submit yet — we’ll enable this soon.'}
                </p>
              </CardContent>
            </Card>
          );
        })()}
        {!reimbursementIntent && (() => {
          const enabled = isClaimTypeEnabled('Liquidation');
          const open = () => { if (enabled) { setClaimType('Liquidation'); setStep(1); } else { setComingSoonType('Liquidation'); } };
          return (
            <Card
              role="button"
              tabIndex={0}
              aria-label={enabled ? 'Start a liquidation' : 'Liquidation — coming soon'}
              aria-disabled={!enabled}
              className={`group h-full border-2 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${enabled ? 'hover:border-primary hover:shadow-lg cursor-pointer' : 'cursor-not-allowed opacity-70'}`}
              onClick={open}
              onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); open(); } }}
            >
              <CardContent className="p-7">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-5 ${enabled ? 'bg-secondary-container/60 text-on-secondary-container' : 'bg-surface-container-high text-outline'}`}>
                  <span className="material-symbols-outlined text-[28px]">account_balance_wallet</span>
                </div>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-headline-sm">Liquidation</h3>
                      {!enabled && <span className="inline-flex items-center rounded-full bg-tertiary-container/60 text-on-tertiary-container px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide">Coming soon</span>}
                    </div>
                    <p className="text-sm text-on-surface-variant mt-2">Submit receipts and settle an existing cash advance.</p>
                  </div>
                  {enabled && <span className="material-symbols-outlined text-outline group-hover:text-primary group-hover:translate-x-1 transition-all">arrow_forward</span>}
                </div>
                <p className="text-xs text-outline mt-5 pt-4 border-t border-outline-variant">
                  {enabled ? 'Available when you have a released advance to settle.' : 'Not available to submit yet — we’ll enable this soon.'}
                </p>
              </CardContent>
            </Card>
          );
        })()}
      </div>
      {comingSoonType && (
        <ConfirmModal
          isOpen
          onClose={() => setComingSoonType(null)}
          onConfirm={() => setComingSoonType(null)}
          title={`${comingSoonType} — coming soon`}
          confirmLabel="Got it"
          showCancel={false}
          closeOnBackdrop
        >
          {COMING_SOON_MESSAGE}
        </ConfirmModal>
      )}
    </div>
  );
}
