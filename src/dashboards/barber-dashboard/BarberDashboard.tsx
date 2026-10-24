import { useState } from 'react';
import { IonContent, IonPage } from '@ionic/react';

import AccountPanel from '../shell/AccountPanel';
import DashboardHeader from '../shell/DashboardHeader';
import DashboardRail from '../shell/DashboardRail';
import { useDashboardScale } from '../shell/useDashboardScale';
import { BARBER_NAV } from './data';
import type { BarberView } from './data';
import Appointments from './sections/Appointments';
import Availability from './sections/Availability';
import Clients from './sections/Clients';
import Services from './sections/Services';
import Today from './sections/Today';
import '../shell/dashboard.css';

/**
 * Barber dashboard. The customer shell with a different rail; no bell, because
 * there is no notification feed behind it yet.
 */
const BarberDashboard: React.FC = () => {
  const [view, setView] = useState<BarberView>('today');
  const [isRailOpen, setIsRailOpen] = useState(false);

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
      <IonContent>
        <div className="trim-dash">
          <DashboardHeader
            sectionLabel={sectionLabel}
            isRailOpen={isRailOpen}
            onToggleRail={() => setIsRailOpen((open) => !open)}
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
                {view === 'today' ? <Today /> : null}
                {view === 'appointments' ? <Appointments /> : null}
                {view === 'availability' ? <Availability /> : null}
                {view === 'clients' ? <Clients /> : null}
                {view === 'services' ? <Services /> : null}
                {view === 'account' ? <AccountPanel role="barber" /> : null}
              </div>
            </main>
          </div>
        </div>
      </IonContent>
    </IonPage>
  );
};

export default BarberDashboard;
