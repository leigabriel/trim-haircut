import { useState } from 'react';
import { IonContent, IonPage } from '@ionic/react';
import { Navigate, useNavigate } from 'react-router-dom';

import { useAuth } from '../auth/AuthProvider';
import './Welcome.css';

const ResetPassword: React.FC = () => {
  const navigate = useNavigate();
  const { session, isLoading, setPassword, signOut } = useAuth();
  const [password, setPasswordValue] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [done, setDone] = useState(false);

  if (!isLoading && !session) return <Navigate to="/home" replace />;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirmation) {
      setError('Passwords do not match.');
      return;
    }
    setIsSaving(true);
    const result = await setPassword(password);
    setIsSaving(false);
    if (!result.ok) {
      setError(result.error ?? 'Could not reset password.');
      return;
    }
    setDone(true);
  };

  return (
    <IonPage>
      <IonContent>
        <main className="trim-welcome">
          <div className="trim-welcome__inner">
            <form className="trim-welcome__form" onSubmit={submit} noValidate>
              <h1 className="trim-welcome__title">Reset your password</h1>
              <p className="trim-welcome__lede">
                {done
                  ? 'Your password has been updated. You can continue to your dashboard.'
                  : 'Enter a new password for your Trim account.'}
              </p>

              {!done ? (
                <>
                  <label className="trim-welcome__label" htmlFor="trim-reset-password">New password</label>
                  <input
                    id="trim-reset-password"
                    className="trim-welcome__input"
                    type="password"
                    autoComplete="new-password"
                    value={password}
                    onChange={(event) => setPasswordValue(event.target.value)}
                    disabled={isSaving}
                  />

                  <label className="trim-welcome__label" htmlFor="trim-reset-confirm" style={{ marginTop: '1rem' }}>
                    Confirm new password
                  </label>
                  <input
                    id="trim-reset-confirm"
                    className="trim-welcome__input"
                    type="password"
                    autoComplete="new-password"
                    value={confirmation}
                    onChange={(event) => setConfirmation(event.target.value)}
                    disabled={isSaving}
                  />

                  {error ? <p className="trim-welcome__error" role="alert">{error}</p> : null}

                  <button className="trim-welcome__submit" type="submit" disabled={isSaving}>
                    {isSaving ? 'Saving' : 'Save new password'}
                  </button>
                </>
              ) : (
                <div style={{ display: 'grid', gap: '0.75rem' }}>
                  <button className="trim-welcome__submit" type="button" onClick={() => navigate('/dashboard', { replace: true })}>
                    Continue to dashboard
                  </button>
                  <button className="trim-welcome__submit" type="button" onClick={() => void signOut()} style={{ background: 'transparent', color: 'inherit', border: '1px solid currentColor' }}>
                    Sign out
                  </button>
                </div>
              )}
            </form>
          </div>
        </main>
      </IonContent>
    </IonPage>
  );
};

export default ResetPassword;
