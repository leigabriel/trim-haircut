import { useState } from 'react';
import { IonContent, IonPage } from '@ionic/react';

import AccountPanel from '../shell/AccountPanel';
import DashboardHeader from '../shell/DashboardHeader';
import DashboardRail from '../shell/DashboardRail';
import NotificationPanel from '../shell/NotificationPanel';
import { useDashboardScale } from '../shell/useDashboardScale';
import { useBookings } from '../booking/useBookings';
import { BARBER_NAV } from './data';
import type { BarberView } from './data';
import Appointments from './sections/Appointments';
import Overview from './sections/Overview';
import Ratings from './sections/Ratings';
import { useBarberNotifications } from './useNotifications';
import '../shell/dashboard.css';
import './barber.css';

/**
 * Barber dashboard. The customer shell with a different rail; the bell is
 * backed by the bookings feed derived from this chair.
 */
const BarberDashboard: React.FC = () => {
  const [view, setView] = useState<BarberView>('overview');
  const [isRailOpen, setIsRailOpen] = useState(false);
  const [isPanelOpen, setIsPanelOpen] = useState(false);

  // RLS narrows this to the bookings assigned to this barber's chair. Shared by
  // Overview and Appointments so a status change on one is visible on the other.
  const bookings = useBookings();
  const notifications = useBarberNotifications({ bookings });

  useDashboardScale();

  const select = (next: string) => {
    setView(next as BarberView);
    setIsRailOpen(false);
  };

  const isAccount = view === 'account';
  const sectionLabel = isAccount
    ? 'Account'
    : (BARBER_NAV.find((item) => item.id === view)?.label ?? '');

  return (
    <IonPage>
      {/* The main column is the scroll container, as on the other dashboards.
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
              items={BARBER_NAV}
              view={view}
              onSelect={select}
              isOpen={isRailOpen}
              accountId="account"
              roleLabel="Barber"
            />

            <main className="trim-dash__main">
              <div className="trim-section">
                {view === 'overview' ? <Overview bookings={bookings} /> : null}
                {view === 'appointments' ? (
                  <Appointments bookings={bookings} />
                ) : null}
                {view === 'ratings' ? <Ratings /> : null}
                {view === 'account' ? <AccountPanel role="barber" /> : null}
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

export default BarberDashboard;
