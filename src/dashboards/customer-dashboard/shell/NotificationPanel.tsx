import { useEffect, useRef } from 'react';

import { NOTIFICATIONS } from '../notifications';

interface NotificationPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Right side panel. Docked rather than modal: the dashboard stays usable
 * behind it, so it slides in over the main column instead of taking focus
 * hostage. Escape closes it and returns focus to the bell.
 */
const NotificationPanel: React.FC<NotificationPanelProps> = ({ isOpen, onClose }) => {
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
          <h2 className="trim-notify__title">Notifications</h2>
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

        <ul className="trim-notify__list">
          {NOTIFICATIONS.map((item) => (
            <li
              className={`trim-notify__item${item.isUnread ? ' trim-notify__item--unread' : ''}`}
              key={item.id}
            >
              <div className="trim-notify__row">
                <h3 className="trim-notify__item-title">{item.title}</h3>
                <span className="trim-notify__when">{item.when}</span>
              </div>
              <p className="trim-notify__item-body">{item.body}</p>
            </li>
          ))}
        </ul>
      </aside>
    </>
  );
};

export default NotificationPanel;