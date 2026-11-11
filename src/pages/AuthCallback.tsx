import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { IonContent, IonPage } from '@ionic/react';

import { useAuth } from '../auth/AuthProvider';
import { supabase } from '../lib/supabase';
import './AuthCallback.css';

const EXCHANGE_FAILED = 'Could not complete sign in. Try again.';
const NOTHING_TO_VERIFY = 'That link is no longer valid. Start again from the app.';

const AuthCallback: React.FC = () => {
  const navigate = useNavigate();
  const { profile, isProfileReady } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [isRecovery, setIsRecovery] = useState(false);

  const hasUsername = Boolean(profile?.username);
  const isSettled = isSignedIn && isProfileReady;

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const providerError = params.get('error') || hashParams.get('error');
    const type = params.get('type') || hashParams.get('type');

    if (providerError) {
      setError(
        params.get('error_description') ||
          hashParams.get('error_description') ||
          'Sign in or verification was cancelled. You can try again whenever you like.',
      );
      return;
    }

    let active = true;
    const done = (recovery = false) => {
      if (!active) return;
      setIsRecovery(recovery);
      setIsSignedIn(true);
    };
    const failed = () => {
      if (active) setError(EXCHANGE_FAILED);
    };

    const run = async () => {
      try {
        const code = params.get('code');
        if (code) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) return failed();
          return done(type === 'recovery');
        }

        const tokenHash = params.get('token_hash') || hashParams.get('token_hash');
        const otpType = (type || params.get('type') || hashParams.get('type')) as
          | 'signup'
          | 'recovery'
          | 'invite'
          | 'magiclink'
          | 'email_change'
          | 'email'
          | null;

        if (tokenHash && otpType) {
          const { error: verifyError } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: otpType,
          });
          if (verifyError) return failed();
          return done(otpType === 'recovery');
        }

        // Some flows establish session via URL hash and Supabase client parsing.
        const { data } = await supabase.auth.getSession();
        if (data.session) return done(type === 'recovery');

        return setError(NOTHING_TO_VERIFY);
      } catch {
        return failed();
      }
    };

    void run();
    return () => {
      active = false;
    };
  }, []);

  if (isSettled && isRecovery) return <Navigate to="/reset-password" replace />;
  if (isSettled && hasUsername) return <Navigate to="/dashboard" replace />;

  return (
    <IonPage>
      <IonContent>
        <main className="trim-callback">
          {error && (
            <>
              <p className="trim-callback__error">{error}</p>
              <button className="trim-callback__back" type="button" onClick={() => navigate('/home')}>
                Back to Trim
              </button>
            </>
          )}

          {!error && isSettled && !isRecovery && (
            <div className="trim-callback__panel">
              <span className="trim-callback__tick" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="30" height="30" fill="none">
                  <path
                    d="M5 13l4.5 4.5L19 7"
                    stroke="currentColor"
                    strokeWidth="2.25"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
              <h1 className="trim-callback__title">Account verified</h1>
              <p className="trim-callback__note">
                Your account is ready. Continue to set up your profile and access your dashboard.
              </p>
              <div className="trim-callback__actions">
                <button className="trim-callback__primary" type="button" onClick={() => navigate('/dashboard', { replace: true })}>
                  Continue
                </button>
              </div>
            </div>
          )}

          {!error && !isSettled && (
            <p className="trim-callback__pending">Verifying your account</p>
          )}
        </main>
      </IonContent>
    </IonPage>
  );
};

export default AuthCallback;
