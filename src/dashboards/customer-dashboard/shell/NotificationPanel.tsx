import { useEffect, useRef } from 'react';

import type { DashboardView } from '../data';
import type { NotificationItem } from '../notifications';
import { relativeTime } from '../time';

interface NotificationPanelProps {
  isOpen: boolean;
  onClose: () => void;
  items: NotificationItem[];
  unreadCount: number;
  isLoading: boolean;
  hasError: boolean;
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
  onOpenView: (view: DashboardView) => void;
}

const KIND_LABEL: Record<NotificationItem['kind'], string> = {
  booking: 'Booking',
  face: 'Face reading',
  chat: 'Trimo',
};

/**
 * Right side panel. Docked rather than modal: the dashboard stays usable
 * behind it, so it slides in over the main column instead of taking focus
 * hostage. Escape closes it and returns focus to the bell.
 *
 * Every row is a real booking, face reading or conversation, and opens the
 * section that owns it. Read state is kept locally per account.
 */
const NotificationPanel: React.FC<NotificationPanelProps> = ({
  isOpen,
  onClose,
  items,
  unreadCount,
  isLoading,
  hasError,
  onMarkRead,
  onMarkAllRead,
  onOpenView,
}) => {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      onClose();
    };

    document.addEventListener('keydown', handleKeyDown);
    closeRef.current?.focus();

    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const openItem = (item: NotificationItem) => {
    onMarkRead(item.id);
    onClose();
    onOpenView(item.view);
  };

  return (
    <>
      {/* Click catcher: dismisses without stealing focus from the panel. */}
      <div
        className={`trim-notify__scrim${isOpen ? ' trim-notify__scrim--on' : ''}`}
        onClick={onClose}
        aria-hidden="true"
      />

      <aside
        className={`trim-notify${isOpen ? ' trim-notify--open' : ''}`}
        id="trim-dash-notifications"
        aria-label="Notifications"
        // Kept out of the tab order while closed, so it cannot be reached.
        aria-hidden={!isOpen}
        inert={!isOpen ? true : undefined}
      >
        <div className="trim-notify__head">
          <h2 className="trim-notify__title">
            Notifications
            {unreadCount > 0 ? (
              <span className="trim-notify__count">{unreadCount} new</span>
            ) : null}
          </h2>

          <div className="trim-notify__head-actions">
            {unreadCount > 0 ? (
              <button className="trim-notify__mark" type="button" onClick={onMarkAllRead}>
                Mark all read
              </button>
            ) : null}

            <button
              ref={closeRef}
              className="trim-notify__close"
              type="button"
              onClick={onClose}
            >
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
                <path
                  d="M6 6l12 12M18 6L6 18"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </svg>
              <span className="trim-visually-hidden">Close notifications</span>
            </button>
          </div>
        </div>

        <ul className="trim-notify__list">
          {items.length === 0 ? (
            <li className="trim-notify__state">
              {isLoading
                ? 'Checking your bookings, reading and Trimo history…'
                : hasError
                  ? 'Some account activity could not be loaded. Try again in a moment.'
                  : 'You are all caught up. New bookings, readings and Trimo activity will show up here.'}
            </li>
          ) : (
            items.map((item) => (
              <li key={item.id}>
                <button
                  className={`trim-notify__item trim-notify__item--action${
                    item.isUnread ? ' trim-notify__item--unread' : ''
                  }`}
                  type="button"
                  onClick={() => openItem(item)}
                >
                  <span className="trim-notify__kind">{KIND_LABEL[item.kind]}</span>
                  <span className="trim-notify__row">
                    <span className="trim-notify__item-title">{item.title}</span>
                    <span className="trim-notify__when">{relativeTime(item.at)}</span>
                  </span>
                  <span className="trim-notify__item-body">{item.body}</span>
                </button>
              </li>
            ))
          )}
        </ul>
      </aside>
    </>
  );
};

export default NotificationPanel;
