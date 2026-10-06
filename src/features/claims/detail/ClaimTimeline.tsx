import { StatusHistory, User, ClaimStatus } from '../../../types';
import { formatDateTime } from '../../../lib/date';

export interface ClaimTimelineProps {
  history: StatusHistory[];
  users: Array<Pick<User, 'id' | 'name'>>;
  className?: string;
}

/**
 * Claim-specific horizontal History table/stepper component.
 * Displays all lifecycle steps inside a single card container with dashboard module styling.
 */
export function ClaimTimeline({
  history,
  users,
  className = 'flex-1',
}: ClaimTimelineProps) {
  // Sort chronologically (oldest first) so progress flows left to right
  const sorted = [...history].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  // Collect steps until REJECTED; auto-ends immediately after rejected step
  const visibleEvents: StatusHistory[] = [];
  for (const h of sorted) {
    visibleEvents.push(h);
    if (
      h.newStatus === ClaimStatus.REJECTED ||
      h.newStatus?.toLowerCase() === 'rejected'
    ) {
      break;
    }
  }

  return (
    <div
      className={`w-full rounded-xl border border-slate-200/80 bg-white p-5 shadow-xs sm:p-6 ${className}`}
    >
      {/* Header */}
      <div className="mb-6 flex items-center justify-between border-b border-slate-100 pb-3.5">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth="2"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
              />
            </svg>
          </div>
          <h3 className="text-base font-semibold text-slate-900 tracking-tight">
            History
          </h3>
        </div>

        <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
          {visibleEvents.length} {visibleEvents.length === 1 ? 'event' : 'events'}
        </span>
      </div>

      {/* Empty State */}
      {visibleEvents.length === 0 ? (
        <div className="py-8 text-center">
          <p className="text-sm text-slate-500">No activity recorded yet.</p>
        </div>
      ) : (
        /* Single horizontal stepper table */
        <div className="overflow-x-auto pb-2">
          <div
            className="grid w-full gap-2 items-start"
            style={{
              gridTemplateColumns: `repeat(${visibleEvents.length}, minmax(${
                visibleEvents.length > 3 ? '180px' : '0px'
              }, 1fr))`,
            }}
          >
            {visibleEvents.map((h, i) => {
              const user = users.find((u) => u.id === h.changedBy);
              const actorName = user?.name || 'System User';
              const isRejected =
                h.newStatus === ClaimStatus.REJECTED ||
                h.newStatus?.toLowerCase() === 'rejected';
              const isLast = i === visibleEvents.length - 1;
              const isDone = !isLast && !isRejected;
              const isCurrent = isLast && !isRejected;

              return (
                <div
                  key={h.id}
                  className="relative flex flex-col items-center text-center w-full min-w-0 px-2"
                >
                  {/* Horizontal Connecting Line behind nodes */}
                  {i < visibleEvents.length - 1 && (
                    <div
                      className={`absolute top-3.5 sm:top-4 left-1/2 w-full h-0.5 -translate-y-1/2 transition-colors duration-200 ${
                        visibleEvents[i + 1]?.newStatus ===
                          ClaimStatus.REJECTED ||
                        visibleEvents[i + 1]?.newStatus?.toLowerCase() ===
                          'rejected'
                          ? 'bg-rose-300'
                          : 'bg-emerald-500'
                      }`}
                      aria-hidden="true"
                    />
                  )}

                  {/* Node Circle */}
                  <div
                    className={`relative z-10 flex h-7 w-7 sm:h-8 sm:w-8 shrink-0 items-center justify-center rounded-full transition-all duration-200 ${
                      isRejected
                        ? 'bg-rose-600 text-white shadow-md shadow-rose-500/20 ring-4 ring-rose-100'
                        : isCurrent
                        ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20 ring-4 ring-blue-100'
                        : 'bg-emerald-600 text-white shadow-xs ring-4 ring-white'
                    }`}
                    title={`Step ${i + 1} by ${actorName}`}
                  >
                    {isRejected ? (
                      <svg
                        className="h-4 w-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth="2.5"
                        stroke="currentColor"
                        aria-hidden="true"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    ) : isDone ? (
                      <svg
                        className="h-3.5 w-3.5 sm:h-4 sm:w-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth="2.5"
                        stroke="currentColor"
                        aria-hidden="true"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M4.5 12.75l6 6 9-13.5"
                        />
                      </svg>
                    ) : (
                      <span className="text-[11px] sm:text-xs font-bold">
                        {i + 1}
                      </span>
                    )}
                  </div>

                  {/* Step details content */}
                  <div className="mt-3 w-full flex flex-col items-center">
                    {/* STEP - STATUS */}
                    <p
                      className={`text-xs font-bold uppercase tracking-wider ${
                        isRejected
                          ? 'text-rose-700'
                          : isCurrent
                          ? 'text-blue-600'
                          : 'text-slate-800'
                      }`}
                    >
                      STEP {i + 1} - {isRejected ? 'REJECTED' : h.newStatus}
                    </p>

                    {/* IF REJECTED: by "who rejected" */}
                    {isRejected && (
                      <p className="text-xs font-semibold text-rose-600 mt-0.5">
                        by {actorName}
                      </p>
                    )}

                    {/* MESSAGE */}
                    {h.comment ? (
                      <div
                        className={`mt-2 rounded-lg border p-2 text-xs text-center w-full break-words ${
                          isRejected
                            ? 'border-rose-200 bg-rose-50/70 text-rose-700 italic'
                            : isCurrent
                            ? 'border-blue-100 bg-blue-50/50 text-slate-700 italic'
                            : 'border-slate-200/80 bg-slate-50/80 text-slate-600 italic'
                        }`}
                      >
                        “{h.comment}”
                      </div>
                    ) : (
                      <div className="mt-2 text-xs text-slate-400 italic">—</div>
                    )}

                    {/* DATE & TIME */}
                    <p className="mt-2 text-[10px] sm:text-[11px] text-slate-400 font-medium">
                      {formatDateTime(h.timestamp)}
                    </p>

                    <span className="sr-only">{actorName}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
