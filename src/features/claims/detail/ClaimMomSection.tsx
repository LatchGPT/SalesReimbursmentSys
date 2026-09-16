import { Card, CardHeader, CardContent } from '../../../components/ui/Card';
import { Claim, MOM } from '../../../types';
import { formatDateTime } from '../../../lib/date';
import { formatContactsDisplay } from '../../../lib/momContacts';
import { uploadUrl } from '../../../lib/api';

export function ClaimMomSection({
  mom,
  claim,
}: {
  mom: MOM;
  claim: Claim;
}) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="bg-surface-container-low/60 border-b border-outline-variant">
        <div>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">description</span>
            <h3 className="font-headline-md text-on-surface">Complete Minutes of Meeting</h3>
          </div>
          <p className="text-body-sm text-outline mt-1">The complete supporting record for this reimbursement.</p>
        </div>
        {mom.fileUrl && (
          <a
            href={uploadUrl(mom.fileUrl)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-outline-variant bg-white text-sm font-semibold text-primary hover:bg-primary/5"
          >
            <span className="material-symbols-outlined text-[17px]">download</span>
            Download attachment
          </a>
        )}
      </CardHeader>
      <CardContent className="p-0">
        <dl className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-px bg-outline-variant border-b border-outline-variant">
          {[
            ['Company', mom.companyName || claim.client || '—'],
            ['Purpose', mom.purposeOfMeeting || '—'],
            ['Date', mom.meetingDate ? formatDateTime(mom.meetingDate) : '—'],
            ['Location', mom.location || '—'],
            ['Contact person', formatContactsDisplay(mom.contactPerson, mom.contactPersonDesignation) || '—'],
            ['Contact email', mom.contactPersonEmail || '—'],
            ['Meeting type', mom.meetingType || '—'],
            ['Category', mom.category || '—'],
          ].map(([label, value]) => (
            <div key={label} className="bg-white p-4">
              <dt className="text-[11px] font-bold uppercase tracking-wider text-outline">{label}</dt>
              <dd className="text-sm font-medium text-on-surface mt-1">{value}</dd>
            </div>
          ))}
        </dl>
        <div className="p-6 sm:p-8 space-y-8">
          <section>
            <h4 className="font-headline-sm text-on-surface mb-3">Discussion</h4>
            <div className="text-body-base text-on-surface-variant whitespace-pre-wrap leading-7">
              {mom.description || mom.summary || 'No discussion was recorded.'}
            </div>
          </section>
          <section className="pt-6 border-t border-outline-variant">
            <h4 className="font-headline-sm text-on-surface mb-3">Agreements and decisions</h4>
            <div className="text-body-base text-on-surface-variant whitespace-pre-wrap leading-7">
              {mom.agreements || 'No separate agreements were recorded.'}
            </div>
          </section>
          <section className="pt-6 border-t border-outline-variant">
            <h4 className="font-headline-sm text-on-surface mb-3">Action items</h4>
            <div className="text-body-base text-on-surface-variant whitespace-pre-wrap leading-7">
              {mom.actionItems || 'No action items were recorded.'}
            </div>
          </section>
        </div>
      </CardContent>
    </Card>
  );
}
