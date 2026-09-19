import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card } from '../../../components/ui/Card';
import { useAppContext } from '../../../components/AppContext';
import { NotificationsView } from '../../../components/shared/NotificationsView';

export * from '../../../components/shared/NotificationsView';

export function Notifications() {
  const { emails, currentUser } = useAppContext();
  const [searchParams] = useSearchParams();

  const unreadCount = useMemo(() => {
    return emails.filter(e => e.recipientId === currentUser.id && !e.read).length;
  }, [emails, currentUser.id]);

  return (
    <div className="space-y-4 w-full h-[calc(100vh-140px)] flex flex-col">
      <div className="flex items-center justify-between">
        <h1 className="text-headline-lg font-semibold text-brand-slate">
          Notifications
          {unreadCount > 0 && <span className="text-primary text-body-base ml-2">({unreadCount} unread)</span>}
        </h1>
      </div>

      <Card className="flex-1 overflow-hidden flex flex-col bg-surface-container-lowest !p-0">
        <NotificationsView initialSelectedId={searchParams.get('id')} />
      </Card>
    </div>
  );
}
