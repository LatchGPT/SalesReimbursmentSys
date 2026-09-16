import { Card, CardContent } from '../../../components/ui/Card';
import { StatusHistory, User, ClaimStatus } from '../../../types';
import { formatDateTime } from '../../../lib/date';

export function ClaimTimeline({
  history,
  users,
}: {
  history: StatusHistory[];
  users: User[];
}) {
  return (
    <Card className="flex-1">
      <CardContent className="p-6">
        <div className="flex items-center gap-2 mb-6">
          <span className="material-symbols-outlined text-primary">history</span>
          <h3 className="font-headline-md text-on-surface">History</h3>
        </div>
        <div className="relative space-y-8 before:absolute before:inset-0 before:ml-5 before:-translate-x-px before:h-full before:w-0.5 before:bg-outline-variant">
          {history.map((h) => {
            const user = users.find(u => u.id === h.changedBy);
            const isSubmit = h.newStatus === ClaimStatus.SUBMITTED;
            return (
              <div key={h.id} className="relative flex items-start gap-4">
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ring-4 ring-surface-container-lowest z-10 ${isSubmit ? 'bg-primary-fixed text-primary-fixed-dim' : 'bg-green-100 text-green-600'}`}>
                  <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>{isSubmit ? 'send' : 'check'}</span>
                </div>
                <div className="flex flex-col">
                  <p className="font-label-md text-on-surface">{user?.name || 'System User'} <span className="font-normal text-on-surface-variant">• {h.newStatus}</span></p>
                  <p className="font-body-sm text-outline">{formatDateTime(h.timestamp)}</p>
                  {h.comment && (
                    <div className="mt-2 p-3 bg-surface-container-low rounded-lg border border-outline-variant/30">
                      <p className="font-body-sm text-on-surface-variant italic">"{h.comment}"</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
