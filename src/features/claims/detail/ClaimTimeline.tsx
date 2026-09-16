import { StatusHistory, User } from '../../../types';
import { formatDateTime } from '../../../lib/date';
import { Timeline, TimelineEvent } from '../../../components/ui/Timeline';

export interface ClaimTimelineProps {
  history: StatusHistory[];
  users: Array<Pick<User, 'id' | 'name'>>;
  className?: string;
}

/**
 * Claim-specific adapter for the Timeline component.
 * Maps status history records and user identities into TimelineEvent items.
 */
export function ClaimTimeline({
  history,
  users,
  className = 'flex-1',
}: ClaimTimelineProps) {
  const events: TimelineEvent[] = history.map((h) => {
    const user = users.find((u) => u.id === h.changedBy);
    return {
      id: h.id,
      actor: user?.name || 'System User',
      action: h.newStatus,
      timestamp: formatDateTime(h.timestamp),
      note: h.comment || undefined,
      status: 'completed',
    };
  });

  return (
    <Timeline
      title="History"
      events={events}
      className={className}
    />
  );
}
