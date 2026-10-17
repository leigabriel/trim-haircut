import type { ReactNode } from 'react';
import { IonContent, IonPage } from '@ionic/react';
import { Navigate } from 'react-router-dom';

import { useAuth } from './AuthProvider';

interface RequireAuthProps {
  children: ReactNode;
  /** Route to /welcome while the profile has no username. */
  requireUsername?: boolean;
}

export const RequireAuth: React.FC<RequireAuthProps> = ({ children, requireUsername }) => {
  const { session, profile, isLoading, isProfileLoading } = useAuth();

  // No redirect while loading, or a hard refresh bounces a signed-in customer
  // to /home. The ion-page shell is required: IonRouterOutlet expects one.
  //
  // isProfileLoading counts too. Email sign in and registration establish a
  // session here, and the profile row is fetched just after: checking only
  // isLoading saw a null profile mid-flight and sent a customer who already
  // has a username back to the form to type it again.
  if (isLoading || (session && isProfileLoading)) {
    return (
      <IonPage>
        <IonContent>
          <div className="trim-guard" aria-busy="true">
            <span className="trim-visually-hidden">Loading</span>
          </div>
        </IonContent>
      </IonPage>
    );
  }

  if (!session) return <Navigate to="/home" replace />;

  if (requireUsername && !profile?.username) {
    return <Navigate to="/welcome" replace />;
  }

  return <>{children}</>;
};