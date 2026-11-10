import { useEffect, useState } from 'react';
import { IonContent, IonPage } from '@ionic/react';
import { useSearchParams } from 'react-router-dom';

import ChatView from './ai/ChatView';
import ConversationList from './ai/ConversationList';
import { useConversations } from './ai/useConversations';
import { useFaceProfile } from './face/useFaceProfile';
import { DASHBOARD_NAV } from './data';
import type { DashboardView } from './data';
import { useNotifications } from './useNotifications';
import Account from './sections/Account';
import Booking from './sections/Booking';
import Camera from './sections/Camera';
import FaceShape from './sections/FaceShape';
import Overview from './sections/Overview';
import Recommendation from './sections/Recommendation';
import { useBookings } from '../booking/useBookings';
import { COORDS } from '../../components/sections/Location/shop';
import DashboardHeader from '../shell/DashboardHeader';
import DashboardRail from '../shell/DashboardRail';
import NotificationPanel from '../shell/NotificationPanel';
import { useDashboardScale } from '../shell/useDashboardScale';
import '../shell/dashboard.css';

interface DashboardWeather {
  label: string;
  temperature: string;
}

const describeWeatherCode = (code: number): string => {
  if (code === 0) return 'Clear sky';
  if (code === 1 || code === 2) return 'Partly cloudy';
  if (code === 3) return 'Overcast';
  if (code === 45 || code === 48) return 'Fog';
  if (code >= 51 && code <= 57) return 'Drizzle';
  if (code >= 61 && code <= 67) return 'Rain';
  if (code >= 71 && code <= 77) return 'Snow';
  if (code >= 80 && code <= 82) return 'Rain showers';
  if (code >= 95) return 'Thunderstorm';
  return 'Weather';
};

/**
 * Customer dashboard. Two column shell: rail and section.
 *
 * Trimo is the exception and adds its conversation list between the two, which
 * is what .trim-dash__grid--with-list is for.
 *
 * No site Nav here: this is an app surface, not a marketing page.
 */
const CustomerDashboard: React.FC = () => {
  const [searchParams] = useSearchParams();
  const requestedView = searchParams.get('view');
  const isValidView = (value: string | null): value is DashboardView =>
    value !== null &&
    (
      value === 'account' ||
      DASHBOARD_NAV.some((item) => item.id === value)
    );

  const [view, setView] = useState<DashboardView>(() =>
    isValidView(requestedView) ? requestedView : 'overview',
  );

  useEffect(() => {
    if (isValidView(requestedView)) setView(requestedView);
  }, [requestedView]);

  const [isRailOpen, setIsRailOpen] = useState(false);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [trimoPrompt, setTrimoPrompt] = useState<string | null>(null);

  // Mounted unconditionally so a chat in progress survives switching sections.
  const chat = useConversations();
  // Shared, so a scan that lands in FaceShape is already reflected in Profile
  // and Recommendation when the customer clicks through. Three sections reading
  // independently is how a just-saved shape shows up as "not set" next screen.
  const face = useFaceProfile();
  // One bookings query for the whole dashboard: the customer's own rows, with
  // the window and ordering handled by the page.
  const bookings = useBookings();
  const [weather, setWeather] = useState<DashboardWeather | null>(null);

  useEffect(() => {
    let active = true;
    const [lat, lon] = COORDS;
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&timezone=Asia%2FManila`;

    fetch(url)
      .then(async (response) => {
        if (!response.ok) throw new Error('Weather request failed');
        return (await response.json()) as {
          current?: { temperature_2m?: number; weather_code?: number };
        };
      })
      .then((data) => {
        if (!active) return;
        const temp = data.current?.temperature_2m;
        const code = data.current?.weather_code;
        if (typeof temp !== 'number' || typeof code !== 'number') return;
        setWeather({
          temperature: `${Math.round(temp)}°C`,
          label: describeWeatherCode(code),
        });
      })
      .catch(() => {
        if (active) setWeather(null);
      });

    return () => {
      active = false;
    };
  }, []);

  // The bell is derived from the rows above, not a placeholder feed. Read
  // state is local to this account and device.
  const notifications = useNotifications({
    bookings,
    face,
    conversations: chat.conversations,
    conversationsLoading: chat.isLoading,
  });

  // The dashboard's type is all rem, so the only lever that scales it (and the
  // rail with it) is the root size. Shared with the admin and barber surfaces.
  useDashboardScale();

  const select = (next: DashboardView) => {
    setView(next);
    setIsRailOpen(false);
  };

  /** Carries a question from FaceShape into Trimo rather than asking again. */
  const askTrimo = (prompt: string) => {
    setTrimoPrompt(prompt);
    select('ai');
  };

  const current = DASHBOARD_NAV.find((item) => item.id === view);
  const isAccount = view === 'account';
  const isAi = view === 'ai';
  const sectionLabel = isAccount ? 'Account' : (current?.label ?? '');

  return (
    <IonPage>
      {/* The dashboard owns its own scroll containers: the main column and the
          chat thread. Leaving IonContent scrollable as well produced a second
          scrollbar on tall sections such as Account. */}
      <IonContent scrollY={false}>
        <div className="trim-dash">
          <DashboardHeader
            sectionLabel={sectionLabel}
            isRailOpen={isRailOpen}
            onToggleRail={() => setIsRailOpen((open) => !open)}
            unreadCount={notifications.unreadCount}
            isPanelOpen={isPanelOpen}
            onTogglePanel={() => setIsPanelOpen((open) => !open)}
            weather={weather}
          />

          <div className={`trim-dash__grid${isAi ? ' trim-dash__grid--with-list' : ''}`}>
            <DashboardRail
              items={DASHBOARD_NAV}
              view={view}
              onSelect={(next) => select(next as DashboardView)}
              isOpen={isRailOpen}
              accountId="account"
            />

            {isAi ? <ConversationList chat={chat} /> : null}

            <main
              className={`trim-dash__main${
                isAccount
                  ? ' trim-dash__main--centred'
                  : isAi
                    ? ' trim-dash__main--flush'
                    : ''
              }`}
            >
              {/* Account owns its own centring, so it sits outside the
                  width-capped .trim-section wrapper the data sections use.
                  Chat fills the pane edge to edge, for the same reason. */}
              {isAccount ? (
                <Account face={face} onAnalyzeFace={() => select('face-shape')} />
              ) : isAi ? (
                <ChatView chat={chat} pendingPrompt={trimoPrompt} />
              ) : (
                <div className="trim-section">
                  {view === 'overview' ? (
                    <Overview
                      face={face}
                      bookings={bookings}
                      conversations={chat.conversations}
                      isConversationsLoading={chat.isLoading}
                      onAnalyzeFace={() => select('face-shape')}
                      onOpenAi={() => select('ai')}
                      onOpenBooking={() => select('booking')}
                    />
                  ) : null}
                  {view === 'recommendation' ? (
                    <Recommendation
                      face={face}
                      onSetFace={() => select('account')}
                    />
                  ) : null}
                  {view === 'face-shape' ? (
                    <FaceShape
                      profile={face}
                      onAskTrimo={askTrimo}
                    />
                  ) : null}
                  {view === 'camera' ? <Camera /> : null}
                  {view === 'booking' ? <Booking bookings={bookings} /> : null}
                </div>
              )}
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
            onOpenView={(next) => select(next as DashboardView)}
          />
        </div>
      </IonContent>
    </IonPage>
  );
};

export default CustomerDashboard;