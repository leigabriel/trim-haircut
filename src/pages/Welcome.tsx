import { useState } from 'react';
import { IonContent, IonPage } from '@ionic/react';
import { Navigate, useNavigate } from 'react-router-dom';

import { useAuth } from '../auth/AuthProvider';
import './Welcome.css';

const Welcome: React.FC = () => {
  const { session, profile, isLoading, isProfileLoading, saveUsername } = useAuth();
  const navigate = useNavigate();
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const isSettled = !isLoading && !isProfileLoading;

  // A returning customer already has a username, so the form has nothing to
  // ask. Checked only once both reads have settled: a null profile before the
  // query resolves looks identical to "no username yet".
  if (isSettled && !session) return <Navigate to="/home" replace />;
  if (isSettled && session && profile?.username) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setIsSaving(true);

    const result = await saveUsername(value);
    setIsSaving(false);

    if (!result.ok) {
      setError(result.error ?? 'Could not save your username.');
      return;
    }
    navigate('/dashboard', { replace: true });
  };

  return (
    <IonPage>
      <IonContent>
        <main className="trim-welcome">
          <div className="trim-welcome__inner">
            <form className="trim-welcome__form" onSubmit={handleSubmit}>
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
                onChange={(event) => setValue(event.target.value)}
                placeholder="yourname"
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                disabled={isSaving}
              />

              {error && (
                <p className="trim-welcome__error" role="alert">
                  {error}
                </p>
              )}

              <button className="trim-welcome__submit" type="submit" disabled={isSaving}>
                {isSaving ? 'Saving' : 'Continue'}
              </button>

              <p className="trim-welcome__hint">
                3 to 24 characters. Lowercase letters, numbers and underscores.
              </p>
            </form>
          </div>
        </main>
      </IonContent>
    </IonPage>
  );
};

export default Welcome;