import { useEffect, useState } from 'react';
import { IonContent, IonPage } from '@ionic/react';
import { Navigate, useNavigate } from 'react-router-dom';

import { useAuth } from '../auth/AuthProvider';
import {
  USERNAME_MAX_LENGTH,
  USERNAME_MIN_LENGTH,
  normaliseUsername,
  toUsernameInput,
  validateUsername,
} from '../auth/username';
import './Welcome.css';

/**
 * `unknown` means the availability check could not run — the RPC may not be
 * deployed, or the request failed. The form still submits and the unique
 * constraint is the final word, rather than the page claiming a taken name is
 * free.
 */
type Availability = 'idle' | 'checking' | 'available' | 'taken' | 'unknown';

const AVAILABILITY_DELAY_MS = 450;

const Welcome: React.FC = () => {
  const { session, profile, isLoading, isProfileReady, saveUsername, isUsernameAvailable } =
    useAuth();
  const navigate = useNavigate();
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [availability, setAvailability] = useState<Availability>('idle');

  const isSettled = !isLoading && (!session || isProfileReady);
  const validation = validateUsername(value);
  // Empty while the name is incomplete, so the effect does not fire a lookup
  // for a partial value.
  const candidate = validation.ok ? validation.value : '';

  // Ask only once typing pauses: a request per keystroke would be one query per
  // letter and would answer for names the customer has already moved past.
  useEffect(() => {
    if (!candidate) {
      setAvailability('idle');
      return;
    }

    let cancelled = false;
    setAvailability('checking');

    const timer = window.setTimeout(() => {
      void isUsernameAvailable(candidate).then((available) => {
        if (cancelled) return;
        setAvailability(available === null ? 'unknown' : available ? 'available' : 'taken');
      });
    }, AVAILABILITY_DELAY_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [candidate, isUsernameAvailable]);

  // A returning customer already has a username, so the form has nothing to
  // ask. Checked only once both reads have settled: a null profile before the
  // query resolves looks identical to "no username yet".
  if (isSettled && !session) return <Navigate to="/home" replace />;
  if (isSettled && session && profile?.username) {
    return <Navigate to="/dashboard" replace />;
  }

  // Held back until the profile read settles, so a customer who already picked
  // a name never sees the form flash before the redirect above fires.
  if (!isSettled) {
    return (
      <IonPage>
        <IonContent>
          <main className="trim-welcome">
            <p className="trim-welcome__status" role="status">
              Loading your profile
            </p>
          </main>
        </IonContent>
      </IonPage>
    );
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (!validation.ok) {
      setError(validation.error);
      return;
    }

    if (availability === 'taken') {
      setError('That name is taken. Try another.');
      return;
    }

    setIsSaving(true);
    const result = await saveUsername(validation.value);
    setIsSaving(false);

    if (!result.ok) {
      setError(result.error ?? 'Could not save your username.');
      return;
    }
    navigate('/dashboard', { replace: true });
  };

  const showFormatError = value.length > 0 && !validation.ok;

  let statusText = '';
  if (showFormatError && !validation.ok) {
    statusText = validation.error;
  } else if (availability === 'checking') {
    statusText = 'Checking availability';
  } else if (availability === 'available') {
    statusText = `${normaliseUsername(value)} is available.`;
  } else if (availability === 'taken') {
    statusText = 'That name is taken. Try another.';
  }

  return (
    <IonPage>
      <IonContent>
        <main className="trim-welcome">
          <div className="trim-welcome__inner">
            <form className="trim-welcome__form" onSubmit={handleSubmit} noValidate>
              <h1 className="trim-welcome__title">What should we call you?</h1>

              <p className="trim-welcome__lede">
                Pick a name for your Trim profile. You can change it later.
              </p>

              <label className="trim-welcome__label" htmlFor="trim-username">
                Username
              </label>

              <input
                id="trim-username"
                className="trim-welcome__input"
                value={value}
                onChange={(event) => {
                  // Matches the database check constraint, so the field can
                  // never hold a value the save would reject.
                  setValue(toUsernameInput(event.target.value));
                  setError(null);
                }}
                placeholder="yourname"
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                maxLength={USERNAME_MAX_LENGTH}
                disabled={isSaving}
                aria-invalid={showFormatError || availability === 'taken' ? true : undefined}
                aria-describedby="trim-username-help trim-username-status"
              />

              <p className="trim-welcome__hint" id="trim-username-help">
                {USERNAME_MIN_LENGTH} to {USERNAME_MAX_LENGTH} characters. Lowercase
                letters, numbers and underscores.
              </p>

              <p
                className={`trim-welcome__status trim-welcome__status--${availability}`}
                id="trim-username-status"
                aria-live="polite"
              >
                {statusText}
              </p>

              {error && (
                <p className="trim-welcome__error" role="alert">
                  {error}
                </p>
              )}

              <button
                className="trim-welcome__submit"
                type="submit"
                disabled={
                  isSaving ||
                  !validation.ok ||
                  availability === 'checking' ||
                  availability === 'taken'
                }
              >
                {isSaving ? 'Saving' : 'Continue'}
              </button>
            </form>
          </div>
        </main>
      </IonContent>
    </IonPage>
  );
};

export default Welcome;
