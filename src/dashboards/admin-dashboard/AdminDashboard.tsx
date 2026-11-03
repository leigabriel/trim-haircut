import { useState } from 'react';
import { IonContent, IonPage } from '@ionic/react';

import AccountPanel from '../shell/AccountPanel';
import DashboardHeader from '../shell/DashboardHeader';
import DashboardRail from '../shell/DashboardRail';
import NotificationPanel from '../shell/NotificationPanel';
import { useDashboardScale } from '../shell/useDashboardScale';
import { useBookings } from '../booking/useBookings';
import { ADMIN_NAV } from './data';
import type { AdminView } from './data';
import Barbers from './sections/Barbers';
import Bookings from './sections/Bookings';
import Overview from './sections/Overview';
import Reports from './sections/Reports';
import Users from './sections/Users';
import { useAccounts } from './useAccounts';
import { useAdminNotifications } from './useNotifications';
import '../shell/dashboard.css';
import './admin.css';

/**
 * Admin dashboard. Same two column shell as the customer surface: rail and
 * section, no marketing nav.
 *
 * The account list and booking list are read once here and handed to every
 * section that shows them, so switching between Overview, User Manager, Barber
 * Manager, Bookings and Reports does not re-query either table.
 */
const AdminDashboard: React.FC = () => {
  const [view, setView] = useState<AdminView>('overview');
  const [isRailOpen, setIsRailOpen] = useState(false);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const accounts = useAccounts();
  const bookings = useBookings();
  const notifications = useAdminNotifications({ accounts, bookings });

  useDashboardScale();

  const select = (next: string) => {
    setView(next as AdminView);
    setIsRailOpen(false);
  };

  const isAccount = view === 'account';
  const isWide = view === 'bookings' || view === 'reports';
  const sectionLabel = isAccount
    ? 'Account'
    : (ADMIN_NAV.find((item) => item.id === view)?.label ?? '');

  return (
    <IonPage>
      {/* The main column is the scroll container, as on the customer surface.
          IonContent must not add a second scrollbar of its own. */}
      <IonContent scrollY={false}>
        <div className="trim-dash">
          <DashboardHeader
            sectionLabel={sectionLabel}
            isRailOpen={isRailOpen}
            onToggleRail={() => setIsRailOpen((open) => !open)}
            unreadCount={notifications.unreadCount}
            isPanelOpen={isPanelOpen}
            onTogglePanel={() => setIsPanelOpen((open) => !open)}
          />

          <div className="trim-dash__grid">
            <DashboardRail
              items={ADMIN_NAV}
              view={view}
              onSelect={select}
              isOpen={isRailOpen}
              accountId="account"
              roleLabel="Administrator"
            />

            <main className="trim-dash__main">
              <div className={`trim-section${isWide ? ' trim-section--wide' : ''}`}>
                {view === 'overview' ? (
                  <Overview accounts={accounts} bookings={bookings} />
                ) : null}
                {view === 'users' ? <Users accounts={accounts} /> : null}
                {view === 'barbers' ? <Barbers accounts={accounts} /> : null}
                {view === 'bookings' ? (
                  <Bookings bookings={bookings} accounts={accounts} />
                ) : null}
                {view === 'reports' ? (
                  <Reports accounts={accounts} bookings={bookings} />
                ) : null}
                {view === 'account' ? <AccountPanel role="admin" /> : null}
              </div>
            </main>
          </div>

          <NotificationPanel
            isOpen={isPanelOpen}
            onClose={() => setIsPanelOpen(false)}
            items={notifications.items}
            unreadCount={notifications.unreadCount}
            isLoading={notifications.isLoading}
            hasError={notifications.hasError}
            onMarkRead={notifications.markRead}
            onMarkAllRead={notifications.markAllRead}
            onOpenView={select}
          />
        </div>
      </IonContent>
    </IonPage>
  );
};

export default AdminDashboard;
