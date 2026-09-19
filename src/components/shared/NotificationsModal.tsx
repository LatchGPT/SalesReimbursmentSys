import { useMemo } from 'react';
import { Modal } from './Modal';
import { NotificationsView } from './NotificationsView';
import { useAppContext } from '../AppContext';

export interface NotificationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialSelectedId?: string | null;
}

export function NotificationsModal({ isOpen, onClose, initialSelectedId }: NotificationsModalProps) {
  const { currentUser, emails } = useAppContext();

  const unreadCount = useMemo(() => {
    return emails.filter(e => e.recipientId === currentUser.id && !e.read).length;
  }, [emails, currentUser.id]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      titleId="notifications-modal-title"
      className="max-w-5xl w-full h-[85vh] max-h-[85vh] p-0 overflow-hidden bg-surface-container-lowest rounded-2xl shadow-2xl border border-outline-variant flex flex-col"
    >
      {/* Modal Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-outline-variant bg-surface shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
            <span className="material-symbols-outlined text-[22px]">notifications</span>
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h2 id="notifications-modal-title" className="font-headline-sm text-base sm:text-lg font-semibold text-on-surface">
                Notifications
              </h2>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-error/10 text-error text-xs font-bold">
                  {unreadCount} unread
                </span>
              )}
            </div>
            <p className="text-xs text-outline hidden sm:block">View and manage all system updates and alerts</p>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label="Close notifications modal"
          className="p-2 text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary cursor-pointer"
        >
          <span className="material-symbols-outlined text-[20px]">close</span>
        </button>
      </div>

      {/* Modal Body with Notifications List & Reader */}
      <div className="flex-1 min-h-0 relative flex flex-col">
        <NotificationsView initialSelectedId={initialSelectedId} isModal={true} />
      </div>
    </Modal>
  );
}
