import { useState } from 'react';
import { IonModal } from '@ionic/react';
import { useNavigate } from 'react-router-dom';

import { useAuth } from '../../../auth/AuthProvider';
import { normaliseEmail, validateRegistration } from '../../../auth/credentials';
import type { RegistrationErrors } from '../../../auth/credentials';
import GoogleIcon from '../icons/GoogleIcon';
import LegalModal from './LegalModal';
import type { LegalDoc } from './LegalModal';
import './LoginModal.css';

interface LoginModalProps {
  isOpen: boolean;
  onDismiss: () => void;
}

type Tab = 'signin' | 'create';

const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onDismiss }) => {
  const { signInWithGoogle, register, signInWithPassword } = useAuth();
  const navigate = useNavigate();

  const [tab, setTab] = useState<Tab>('signin');
  const [isAgreed, setIsAgreed] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [legalDoc, setLegalDoc] = useState<LegalDoc | null>(null);

  // Sign in
  const [signInEmail, setSignInEmail] = useState('');
  const [signInPassword, setSignInPassword] = useState('');

  // Create
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [errors, setErrors] = useState<RegistrationErrors>({});

  const requireConsent = (): boolean => {
    if (isAgreed) return true;
    setNotice('Please agree to the Terms and Privacy Policy first.');
    return false;
  };

  const handleGoogle = async () => {
    if (!requireConsent()) return;

    setNotice(null);
    setIsRedirecting(true);
    try {
      await signInWithGoogle();
    } catch {
      // The redirect already happened on success, so reaching here is a real
      // failure worth showing.
      setIsRedirecting(false);
      setNotice('Could not start Google sign in. Check your connection and try again.');
    }
  };

  const handleSignIn = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!requireConsent()) return;

    setNotice(null);
    setIsBusy(true);

    const result = await signInWithPassword(normaliseEmail(signInEmail), signInPassword);
    setIsBusy(false);

    if (!result.ok) setNotice(result.error);
    // Unlike Google there is no redirect to come back from, so nothing would
    // move the customer on. Without this they are signed in but still looking
    // at the homepage behind an open modal.
    if (result.ok) {
      onDismiss();
      navigate('/dashboard');
    }
  };

  const handleRegister = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!requireConsent()) return;

    setNotice(null);
    setErrors({});

    const result = validateRegistration({ email, password, confirmation });

    if (!result.ok) {
      setErrors(result.errors);
      return;
    }

    setIsBusy(true);

    const outcome = await register({
      email: result.email,
      password: result.password,
    });

    setIsBusy(false);

    if (!outcome.ok) {
      setErrors({ email: outcome.error });
      return;
    }

    // Straight to the username prompt. The account has no username yet, so
    // going via /dashboard would only bounce through the guard to get here.
    onDismiss();
    navigate('/welcome');
  };

  const switchTab = (next: Tab) => {
    setTab(next);
    setNotice(null);
    setErrors({});
  };

  const hasConsent = (
    <label className="trim-login__consent">
      <input
        className="trim-login__checkbox"
        type="checkbox"
        checked={isAgreed}
        onChange={(event) => {
          setIsAgreed(event.target.checked);
          if (event.target.checked) setNotice(null);
        }}
      />
      <span className="trim-login__legal">
        By continuing, you agree to our{' '}
        <button
          className="trim-login__legal-link"
          type="button"
          onClick={() => setLegalDoc('terms')}
        >
          Terms of Service
        </button>
        . Read our{' '}
        <button
          className="trim-login__legal-link"
          type="button"
          onClick={() => setLegalDoc('privacy')}
        >
          Privacy Policy
        </button>
        .
      </span>
    </label>
  );

  return (
    <IonModal
      isOpen={isOpen}
      onDidDismiss={onDismiss}
      className="trim-login"
      initialBreakpoint={1}
      breakpoints={[0, 1]}
    >
      <div className="trim-login__panel">
        <img className="trim-login__mark" src="/assets/ui/T-1.png" alt="" aria-hidden="true" />

        <button
          className="trim-login__close"
          type="button"
          onClick={onDismiss}
          aria-label="Close login"
        >
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
            <path
              d="M6 6l12 12M18 6L6 18"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
            />
          </svg>
        </button>

        <div className="trim-login__body">
          <h2 className="trim-login__title">
            {tab === 'signin' ? (
              <>
                Trim
                <br />
                Your Face Shape,
                <br />
                Your Best Haircut
              </>
            ) : (
              'Create your account'
            )}
          </h2>

          <div className="trim-login__tabs" role="tablist" aria-label="Account">
            <button
              className={`trim-login__tab${tab === 'signin' ? ' trim-login__tab--on' : ''}`}
              type="button"
              role="tab"
              aria-selected={tab === 'signin'}
              onClick={() => switchTab('signin')}
            >
              Sign in
            </button>
            <button
              className={`trim-login__tab${tab === 'create' ? ' trim-login__tab--on' : ''}`}
              type="button"
              role="tab"
              aria-selected={tab === 'create'}
              onClick={() => switchTab('create')}
            >
              Create account
            </button>
          </div>

          {tab === 'signin' ? (
            <>
              <form onSubmit={handleSignIn} noValidate>
                <label className="trim-login__field">
                  <span className="trim-login__field-label">Email</span>
                  <input
                    className="trim-login__input"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    value={signInEmail}
                    onChange={(event) => setSignInEmail(event.target.value)}
                  />
                </label>

                <label className="trim-login__field">
                  <span className="trim-login__field-label">Password</span>
                  <input
                    className="trim-login__input"
                    type="password"
                    autoComplete="current-password"
                    value={signInPassword}
                    onChange={(event) => setSignInPassword(event.target.value)}
                  />
                </label>

                <button
                  className="trim-login__submit"
                  type="submit"
                  disabled={isBusy}
                >
                  {isBusy ? 'Signing in' : 'Sign in'}
                </button>
              </form>

              <div className="trim-login__rule">
                <span>or</span>
              </div>

              <button
                className="trim-login__google"
                type="button"
                onClick={handleGoogle}
                disabled={isRedirecting}
              >
                <GoogleIcon className="trim-login__google-icon" />
                <span>{isRedirecting ? 'Opening Google' : 'Continue with Google'}</span>
              </button>
            </>
          ) : (
            <form onSubmit={handleRegister} noValidate>
              <label className="trim-login__field">
                <span className="trim-login__field-label">Email</span>
                <input
                  className="trim-login__input"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  value={email}
                  aria-invalid={errors.email ? true : undefined}
                  onChange={(event) => setEmail(event.target.value)}
                />
                {errors.email ? (
                  <span className="trim-login__field-error">{errors.email}</span>
                ) : null}
              </label>

              <label className="trim-login__field">
                <span className="trim-login__field-label">Password</span>
                <input
                  className="trim-login__input"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  aria-invalid={errors.password ? true : undefined}
                  onChange={(event) => setPassword(event.target.value)}
                />
                {errors.password ? (
                  <span className="trim-login__field-error">{errors.password}</span>
                ) : null}
              </label>

              <label className="trim-login__field">
                <span className="trim-login__field-label">Confirm password</span>
                <input
                  className="trim-login__input"
                  type="password"
                  autoComplete="new-password"
                  value={confirmation}
                  aria-invalid={errors.confirmation ? true : undefined}
                  onChange={(event) => setConfirmation(event.target.value)}
                />
                {errors.confirmation ? (
                  <span className="trim-login__field-error">{errors.confirmation}</span>
                ) : null}
              </label>

              <button className="trim-login__submit" type="submit" disabled={isBusy}>
                {isBusy ? 'Creating account' : 'Create account'}
              </button>
            </form>
          )}

          {hasConsent}

          {notice ? (
            <p className="trim-login__notice" role="alert">
              {notice}
            </p>
          ) : null}
        </div>
      </div>

      <LegalModal doc={legalDoc} onDismiss={() => setLegalDoc(null)} />
    </IonModal>
  );
};

export default LoginModal;