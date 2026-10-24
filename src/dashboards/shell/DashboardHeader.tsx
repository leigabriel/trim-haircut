import { BackSquare, Bell } from 'reicon-react';
import { Link } from 'react-router-dom';

interface DashboardHeaderProps {
  sectionLabel: string;
  isRailOpen: boolean;
  onToggleRail: () => void;
  /** Omitted by surfaces that have no notifications, such as admin and barber. */
  unreadCount?: number;
  isPanelOpen?: boolean;
  onTogglePanel?: () => void;
}

/**
 * Header. The brand mark is the Tritopani script T in brand blue, echoing the
 * public nav. Right side carries the notification bell and the back-to-site
 * control, both icon-only.
 *
 * The bell is opt-in: a count with no real feed behind it would be decoration
 * pretending to be data.
 *
 * The back-to-site control routes rather than reloading the document; see the
 * note on it below.
 */
const DashboardHeader: React.FC<DashboardHeaderProps> = ({
  sectionLabel,
  isRailOpen,
  onToggleRail,
  unreadCount,
  isPanelOpen = false,
  onTogglePanel,
}) => (
  <header className="trim-dash__bar">
    <button
      className="trim-dash__rail-toggle"
      type="button"
      aria-expanded={isRailOpen}
      aria-controls="trim-dash-rail"
      onClick={onToggleRail}
    >
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden="true">
        <path
          d="M3 6h18M3 12h18M3 18h18"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
        />
      </svg>
      <span className="trim-visually-hidden">
        {isRailOpen ? 'Close sections' : 'Open sections'}
      </span>
    </button>

    <span className="trim-dash__logo" aria-label="Trim">
      T
    </span>

    <span className="trim-dash__crumb">{sectionLabel}</span>

    <div className="trim-dash__actions">
      {unreadCount !== undefined ? (
        <button
          className={`trim-dash__icon-btn${isPanelOpen ? ' trim-dash__icon-btn--on' : ''}`}
          type="button"
          aria-expanded={isPanelOpen}
          aria-controls="trim-dash-notifications"
          onClick={onTogglePanel}
        >
          {/* Decorative: the count beside it carries the meaning. */}
          <Bell size={19} aria-hidden="true" />
          <span className="trim-dash__badge">{unreadCount}</span>
          <span className="trim-visually-hidden">
            Notifications, {unreadCount} unread
          </span>
        </button>
      ) : null}

      {/* Link, not a plain anchor. A bare href navigates the document, which
          throws away the running app: it refetches index.html, re-parses the
          whole bundle, rebuilds the Supabase client and re-reads the session,
          before any of /home can paint. Routing through the router keeps all of
          that alive, so the section swaps immediately. It stays an anchor, so
          middle-click, copy-link and the status bar preview still work. */}
      <Link className="trim-dash__icon-btn" to="/home" title="Back to site">
        <BackSquare size={19} aria-hidden="true" />
        <span className="trim-visually-hidden">Back to site</span>
      </Link>
    </div>
  </header>
);

export default DashboardHeader;
