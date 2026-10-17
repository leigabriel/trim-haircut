import { useState } from 'react';
import { Navigate, Route } from 'react-router-dom';
import { IonApp, IonRouterOutlet, setupIonicReact } from '@ionic/react';
import { IonReactRouter } from '@ionic/react-router';

import { AuthProvider } from '../auth/AuthProvider';
import { RequireAuth } from '../auth/RequireAuth';
import IntroOverlay from '../components/layout/IntroOverlay';
import CustomerDashboard from '../dashboards/customer-dashboard/CustomerDashboard';
import AuthCallback from '../pages/AuthCallback';
import Home from '../pages/Home';
import Welcome from '../pages/Welcome';

/* Required by Ionic components */
import '@ionic/react/css/core.css';

/* Ionic base styles */
import '@ionic/react/css/normalize.css';
import '@ionic/react/css/structure.css';
import '@ionic/react/css/typography.css';

/* Optional Ionic utils */
import '@ionic/react/css/padding.css';
import '@ionic/react/css/float-elements.css';
import '@ionic/react/css/text-alignment.css';
import '@ionic/react/css/text-transformation.css';
import '@ionic/react/css/flex-utils.css';
import '@ionic/react/css/display.css';

/* Ionic dark palette: always, or class-based. */
/* import '@ionic/react/css/palettes/dark.always.css'; */
/* import '@ionic/react/css/palettes/dark.class.css'; */
import '@ionic/react/css/palettes/dark.system.css';

/* Theme */
import '../theme/variables.css';

setupIonicReact();

const HomeRoute: React.FC<{
  isEntered: boolean;
  onProgress: (ratio: number) => void;
  onModelsReady: () => void;
}> = ({ isEntered, onProgress, onModelsReady }) => (
  <Home isEntered={isEntered} onProgress={onProgress} onModelsReady={onModelsReady} />
);

/**
 * Owns the intro. A fixed three second animation, so it no longer waits on the
 * hero models; the hero fades in when the intro clears.
 */
const HomeWithLoader: React.FC = () => {
  const [isEntered, setIsEntered] = useState(false);

  return (
    <>
      <IntroOverlay onDone={() => setIsEntered(true)} />

      <HomeRoute isEntered={isEntered} onProgress={() => {}} onModelsReady={() => {}} />
    </>
  );
};

const App: React.FC = () => (
  <IonApp>
    <IonReactRouter>
      {/* Inside IonReactRouter: AuthProvider calls useNavigate. */}
      <AuthProvider>
        <IonRouterOutlet>
          {/* The intro lives inside the home route. */}
          <Route path="/home" element={<HomeWithLoader />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/welcome" element={<Welcome />} />

          {/* The guard wraps the IonPage rather than sitting inside its content. */}
          <Route
            path="/dashboard"
            element={
              <RequireAuth requireUsername>
                <CustomerDashboard />
              </RequireAuth>
            }
          />
          <Route path="/" element={<Navigate to="/home" replace />} />
        </IonRouterOutlet>
      </AuthProvider>
    </IonReactRouter>
  </IonApp>
);

export default App;