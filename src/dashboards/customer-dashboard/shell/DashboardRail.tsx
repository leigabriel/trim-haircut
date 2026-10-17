import { useState } from 'react';

import { useAuth } from '../../../auth/AuthProvider';
import ConfirmModal from '../../../components/layout/modals/ConfirmModal';
import type { DashboardView } from '../data';
import { DASHBOARD_NAV } from '../data';

interface DashboardRailProps {
  view: DashboardView;
  onSelect: (next: DashboardView) => void;
  isOpen: boolean;
}

/**
 * Left rail: the section links, then the identity block pinned to the foot.
 * The identity block is the only route into Account, since the section is
 * absent from the nav list above.
 */
const DashboardRail: React.FC<DashboardRailProps> = ({
  view,
  onSelect,
  isOpen,
}) => {
  const { session, profile, signOut } = useAuth();
  const [isConfirmingOut, setIsConfirmingOut] = useState(false);

  const name = profile?.username ?? profile?.displayName ?? 'Guest';
  const initial = name.charAt(0).toUpperCase();
  const isAccount = view === 'account';

  return (
    <>
      <aside
        className={`trim-dash__rail${isOpen ? ' trim-dash__rail--open' : ''}`}
        id="trim-dash-rail"
      >
        <nav className="trim-dash__nav" aria-label="Dashboard sections">
          <ul className="trim-dash__sections">
            {DASHBOARD_NAV.map((item) => {
              const isCurrent = view === item.id;

              return (
                <li key={item.id}>
                  <button
                    className={`trim-dash__link${isCurrent ? ' trim-dash__link--current' : ''}`}
                    type="button"
                    aria-current={isCurrent ? 'page' : undefined}
                    onClick={() => onSelect(item.id)}
                  >
                    {/* Decorative: the label beside it names the section. */}
                    <item.icon className="trim-dash__link-icon" size={20} aria-hidden="true" />

                    <span className="trim-dash__link-label">{item.label}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        <div
          className={`trim-dash__identity${isAccount ? ' trim-dash__identity--current' : ''}`}
        >
          <button
            className="trim-dash__identity-open"
            type="button"
            onClick={() => onSelect('account')}
            aria-current={isAccount ? 'page' : undefined}
          >
            {profile?.avatarUrl ? (
              <img
                className="trim-dash__identity-avatar"
                src={profile.avatarUrl}
                alt=""
              />
            ) : (
              <span className="trim-dash__identity-initial" aria-hidden="true">
                {initial}
              </span>
            )}

            <span className="trim-dash__identity-text">
              <span className="trim-dash__identity-name">{name}</span>
              <span className="trim-dash__identity-email">
                {session?.user.email}
              </span>
            </span>
          </button>

          <button
            className="trim-dash__identity-out"
            type="button"
            onClick={() => setIsConfirmingOut(true)}
          >
            Logout
          </button>
        </div>
      </aside>

      {/* Outside the aside: it has its own overflow and stacking context, and
          the sheet should sit above the whole dashboard. */}
      <ConfirmModal
        isOpen={isConfirmingOut}
        title="Log out of Trim?"
        message={`You are signed in as ${name}. You will need to sign in with Google again to get back in.`}
        confirmLabel="Log out"
        pendingLabel="Logging out…"
        onConfirm={signOut}
        onDismiss={() => setIsConfirmingOut(false)}
      />
    </>
  );
};

export default DashboardRail;
