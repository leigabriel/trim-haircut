import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { IonContent, IonPage } from '@ionic/react';
import type { EmailOtpType } from '@supabase/supabase-js';

import { useAuth } from '../auth/AuthProvider';
import { supabase } from '../lib/supabase';
import './AuthCallback.css';

// Shared by both failure paths: the customer only needs to know it failed.
const EXCHANGE_FAILED = 'Could not complete sign in. Try again.';

// Reached when the URL carries nothing to verify, which means the link was
// altered or already spent. The old copy blamed Google, which was wrong twice
// over: this page also serves email confirmation, and a customer arriving from
// a confirmation email never went near Google.
const NOTHING_TO_VERIFY =
  'That link is no longer valid. Request a fresh code in the app and enter it there.';

// Only what the SDK accepts, so a hand-edited URL cannot push an arbitrary
// string into verifyOtp.
const OTP_TYPES: readonly string[] = [
  'email',
  'signup',
  'invite',
  'magiclink',
  'recovery',
  'email_change',
];

const AuthCallback: React.FC = () => {
  const navigate = useNavigate();
  const { profile, isProfileLoading } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [isSignedIn, setIsSignedIn] = useState(false);

  const hasUsername = Boolean(profile?.username);
  const isSettled = isSignedIn && !isProfileLoading;

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const providerError = params.get('error');

    if (providerError) {
      // `||`, not `??`: an empty error_description is falsy, so `??` would store
      // '' and the ternary would fall through to the pending state.
      setError(
        params.get('error_description') ||
          'Sign in was cancelled. You can try again whenever you like.',
      );
      return;
    }

    let active = true;

    // Held here rather than redirected, so the customer chooses where to land.
    const done = () => {
      if (active) setIsSignedIn(true);
    };

    // Both branches below reject on non-AuthError failures too: blocked or full
    // localStorage, failed client init.
    const failed = () => {
      if (active) setError(EXCHANGE_FAILED);
    };

    // Email confirmation, when the template links with a token hash. Checked
    // before the code branch because it verifies against the address Supabase
    // emailed, so it works from a different device or browser, where no PKCE
    // verifier was ever stored.
    const tokenHash = params.get('token_hash');
    const type = params.get('type');

    if (tokenHash && type && OTP_TYPES.includes(type)) {
      supabase.auth
        .verifyOtp({ token_hash: tokenHash, type: type as EmailOtpType })
        .then(({ error: verifyError }) => (verifyError ? failed() : done()))
        .catch(failed);

      return () => {
        active = false;
      };
    }

    // Google, and any confirmation template still built on the confirmation URL.
    const code = params.get('code');
    if (!code) {
      setError(NOTHING_TO_VERIFY);
      return;
    }

    supabase.auth
      .exchangeCodeForSession(code)
      .then(({ error: exchangeError }) => (exchangeError ? failed() : done()))
      .catch(failed);

    return () => {
      active = false;
    };
  }, [navigate]);

  // Returning customer: straight through to the dashboard, no confirmation
  // step. Sending them to /welcome is what re-prompted for a username they had
  // already set. Gated on isProfileLoading so a slow profiles query does not
  // read as "no username yet".
  if (isSettled && hasUsername) return <Navigate to="/dashboard" replace />;

  return (
      <IonPage>
          <IonContent>
              <main className="trim-callback">
                  {error && (
                      <>
                          <p className="trim-callback__error">{error}</p>
                          <button
                              className="trim-callback__back"
                              type="button"
                              onClick={() => navigate("/home")}
                          >
                              Back to Trim
                          </button>
                      </>
                  )}

                  {!error && isSettled && (
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

                          <h1 className="trim-callback__title">
                              You&apos;re signed in to Trim
                          </h1>

                          {/*
                              Neutral on purpose. This page serves both the
                              emailed confirmation link and Google, and telling
                              an email registrant their Google account is
                              connected was simply untrue.
                          */}
                          <p className="trim-callback__note">
                              Your email is confirmed. Choose a username for your
                              profile, then Trim will start matching styles to your
                              face shape.
                          </p>

                          <div className="trim-callback__actions">
                              <button
                                  className="trim-callback__primary"
                                  type="button"
                                  onClick={() =>
                                      navigate("/welcome", { replace: true })
                                  }
                              >
                                  Continue
                              </button>

                              <button
                                  className="trim-callback__back"
                                  type="button"
                                  onClick={() =>
                                      navigate("/home", { replace: true })
                                  }
                              >
                                  Back to Trim
                              </button>
                          </div>
                      </div>
                  )}

                  {/* Stays pending until the profile settles too, otherwise there is a blank
                      frame between "signed in" and the redirect firing. */}
                  {!error && !isSettled && (
                      <p className="trim-callback__pending">Signing you in</p>
                  )}
              </main>
          </IonContent>
      </IonPage>
  );
};

export default AuthCallback;
