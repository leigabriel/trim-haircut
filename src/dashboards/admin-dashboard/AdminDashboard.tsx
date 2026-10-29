import { useState } from 'react';
import { IonContent, IonPage } from '@ionic/react';

import AccountPanel from '../shell/AccountPanel';
import DashboardHeader from '../shell/DashboardHeader';
import DashboardRail from '../shell/DashboardRail';
import { useDashboardScale } from '../shell/useDashboardScale';
import { useBookings } from '../booking/useBookings';
import { ADMIN_NAV } from './data';
import type { AdminView } from './data';
import Barbers from './sections/Barbers';
import Bookings from './sections/Bookings';
import Catalog from './sections/Catalog';
import Overview from './sections/Overview';
import Users from './sections/Users';
import { useAccounts } from './useAccounts';
import '../shell/dashboard.css';

/**
 * Admin dashboard. Same two column shell as the customer surface: rail and
 * section, no marketing nav.
 *
 * The account list is read once here and handed to the three sections that show
 * it, so switching between Overview, User Manager and Barber Manager does not
 * re-query the profiles table.
 */
const AdminDashboard: React.FC = () => {
  const [view, setView] = useState<AdminView>('overview');
  const [isRailOpen, setIsRailOpen] = useState(false);
  const accounts = useAccounts();
  const bookings = useBookings();

  useDashboardScale();

  const select = (next: string) => {
    setView(next as AdminView);
    setIsRailOpen(false);
  };

  const isAccount = view === 'account';
  const sectionLabel = isAccount
    ? 'Account'
    : (ADMIN_NAV.find((item) => item.id === view)?.label ?? '');

  return (
    <IonPage>
      <IonContent>
        <div className="trim-dash">
          <DashboardHeader
            sectionLabel={sectionLabel}
            isRailOpen={isRailOpen}
            onToggleRail={() => setIsRailOpen((open) => !open)}
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
              <div className="trim-section">
                {view === 'overview' ? <Overview accounts={accounts} /> : null}
                {view === 'users' ? <Users accounts={accounts} /> : null}
                {view === 'barbers' ? <Barbers accounts={accounts} /> : null}
                {view === 'bookings' ? <Bookings bookings={bookings} /> : null}
                {view === 'catalog' ? <Catalog /> : null}
                {view === 'account' ? <AccountPanel role="admin" /> : null}
              </div>
            </main>
          </div>
        </div>
      </IonContent>
    </IonPage>
  );
};

export default AdminDashboard;
