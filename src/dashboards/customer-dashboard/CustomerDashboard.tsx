import { useLayoutEffect, useState } from 'react';
import { IonContent, IonPage } from '@ionic/react';

import ChatView from './ai/ChatView';
import ConversationList from './ai/ConversationList';
import { useConversations } from './ai/useConversations';
import { useFaceProfile } from './face/useFaceProfile';
import { DASHBOARD_NAV } from './data';
import type { DashboardView } from './data';
import Account from './sections/Account';
import Booking from './sections/Booking';
import FaceShape from './sections/FaceShape';
import Overview from './sections/Overview';
import Recommendation from './sections/Recommendation';
import DashboardHeader from './shell/DashboardHeader';
import DashboardRail from './shell/DashboardRail';
import NotificationPanel from './shell/NotificationPanel';
import './CustomerDashboard.css';

/**
 * Customer dashboard. Two column shell: rail and section.
 *
 * Trimo is the exception and adds its conversation list between the two, which
 * is what .trim-dash__grid--with-list is for.
 *
 * No site Nav here: this is an app surface, not a marketing page.
 */
const CustomerDashboard: React.FC = () => {
  const [view, setView] = useState<DashboardView>('overview');
  const [isRailOpen, setIsRailOpen] = useState(false);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [trimoPrompt, setTrimoPrompt] = useState<string | null>(null);

  // Mounted unconditionally so a chat in progress survives switching sections.
  const chat = useConversations();
  // Shared, so a scan that lands in FaceShape is already reflected in Profile
  // and Recommendation when the customer clicks through. Three sections reading
  // independently is how a just-saved shape shows up as "not set" next screen.
  const face = useFaceProfile();

  // The dashboard's type is all rem, so the only lever that scales it (and the
  // rail with it) is the root size. Marking the document while this route is
  // mounted keeps the step out of the marketing pages. Layout effect, not
  // effect, so the larger size is in place before the first paint.
  useLayoutEffect(() => {
    const root = document.documentElement;
    root.classList.add('trim-dash-active');
    return () => root.classList.remove('trim-dash-active');
  }, []);

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
      <IonContent>
        <div className="trim-dash">
          <DashboardHeader
            sectionLabel={sectionLabel}
            isRailOpen={isRailOpen}
            onToggleRail={() => setIsRailOpen((open) => !open)}
            isPanelOpen={isPanelOpen}
            onTogglePanel={() => setIsPanelOpen((open) => !open)}
          />

          <div className={`trim-dash__grid${isAi ? ' trim-dash__grid--with-list' : ''}`}>
            <DashboardRail view={view} onSelect={select} isOpen={isRailOpen} />

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
                      conversations={chat.conversations}
                      onAnalyzeFace={() => select('face-shape')}
                      onOpenAi={() => select('ai')}
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
                  {view === 'booking' ? <Booking /> : null}
                </div>
              )}
            </main>
          </div>

          <NotificationPanel
            isOpen={isPanelOpen}
            onClose={() => setIsPanelOpen(false)}
          />
        </div>
      </IonContent>
    </IonPage>
  );
};

export default CustomerDashboard;