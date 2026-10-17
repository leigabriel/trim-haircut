import { useState } from 'react';
import { IonModal } from '@ionic/react';
import { useNavigate } from 'react-router-dom';

import { useAuth } from '../../../auth/AuthProvider';
import {
  normaliseEmail,
  validateCode,
  validateRegistration,
} from '../../../auth/credentials';
import type { RegistrationErrors } from '../../../auth/credentials';
import { normaliseUsername, validateUsername } from '../../../auth/username';
import GoogleIcon from '../icons/GoogleIcon';
import LegalModal from './LegalModal';
import type { LegalDoc } from './LegalModal';
import './LoginModal.css';

interface LoginModalProps {
  isOpen: boolean;
  onDismiss: () => void;
}

type Tab = 'signin' | 'create';

/**
 * Register is three steps because the emailed code sits between submitting the
 * form and being signed in. Collapsing it into one would mean holding a
 * half-finished password in component state across an email round trip.
 */
type CreateStep = 'form' | 'verify';

const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onDismiss }) => {
  const {
    signInWithGoogle,
    register,
    verifyEmailCode,
    resendEmailCode,
    signInWithPassword,
    isUsernameTaken,
  } = useAuth();
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
  const [createStep, setCreateStep] = useState<CreateStep>('form');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [errors, setErrors] = useState<RegistrationErrors>({});
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState<string | null>(null);
  const [resendNote, setResendNote] = useState<string | null>(null);

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

    const result = validateRegistration({ email, username, password, confirmation }, validateUsername);

    if (!result.ok) {
      setErrors(result.errors);
      return;
    }

    setIsBusy(true);

    // Checked before the round trip so a taken name fails instantly, and again
    // by the unique constraint inside the trigger, because this check cannot be
    // atomic with the signup.
    if (await isUsernameTaken(result.username)) {
      setIsBusy(false);
      setErrors({ username: 'That username is taken. Try another.' });
      return;
    }

    const outcome = await register({
      email: result.email,
      username: result.username,
      password: result.password,
    });

    setIsBusy(false);

    if (!outcome.ok) {
      setErrors({ email: outcome.error });
      return;
    }

    // The account is stored under the normalised address, so that becomes the
    // value shown and the value every later step uses. Leaving the raw input in
    // place meant a capital or a trailing space in the form could be what the
    // code was checked against, which is a mismatch the customer cannot see.
    setEmail(result.email);

    // Email confirmation can be switched off for the project, in which case
    // signup already established the session and no code was ever sent. The
    // verify screen would be a dead end, so go straight in instead.
    if (!outcome.needsConfirmation) {
      onDismiss();
      navigate('/dashboard');
      return;
    }

    setCreateStep('verify');
  };

  const handleVerify = async (event: React.FormEvent) => {
    event.preventDefault();

    setCodeError(null);
    const token = validateCode(code);
    if (!token.ok) {
      setCodeError(token.error);
      return;
    }

    setIsBusy(true);
    const result = await verifyEmailCode(email, token.value);
    setIsBusy(false);

    if (!result.ok) {
      setCodeError(result.error);
      return;
    }

    // Verification is the last step of registration, so it lands in the app
    // rather than back on the homepage with an open modal.
    onDismiss();
    navigate('/dashboard');
  };

  const handleResend = async () => {
    setResendNote(null);
    setCodeError(null);
    setIsBusy(true);

    const result = await resendEmailCode(email);
    setIsBusy(false);

    setResendNote(result.ok ? 'Sent again. Check your inbox.' : result.error);
  };

  const switchTab = (next: Tab) => {
    setTab(next);
    setNotice(null);
    setErrors({});
    setCodeError(null);
    setResendNote(null);
    if (next === 'create') setCreateStep('form');
  };

  const backToSignIn = () => {
    setCreateStep('form');
    setTab('signin');
    setCode('');
    setCodeError(null);
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
          <p className="trim-login__eyebrow">
            {createStep === 'verify' ? 'One more step' : ''}
          </p>

          <h2 className="trim-login__title">
            {tab === 'signin' ? (
              <>
                Trim
                <br />
                Your Face Shape,
                <br />
                Your Best Haircut
              </>
            ) : createStep === 'verify' ? (
              'Check your email'
            ) : (
              'Create your account'
            )}
          </h2>

          {/* Hidden on the verify step: the email is the next action, not a
              different account. */}
          {createStep === 'form' ? (
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
          ) : null}

          {createStep === 'verify' ? (
            <div className="trim-login__verify">
              <p className="trim-login__lede">
                {/* True for whichever form the project&apos;s signup template
                    sends. Supabase issues a 6 digit token either way, but the
                    default template emails it as a link, so promising only a
                    code left anyone who opened that link with no idea what to
                    do here. */}
                We emailed <strong>{email}</strong> to finish setting up your
                account. Enter the six digit code below, or open the link in that
                email.
              </p>

              <form onSubmit={handleVerify} noValidate>
                <label className="trim-login__field">
                  <span className="trim-login__field-label">Verification code</span>
                  <input
                    className="trim-login__input trim-login__input--code"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    value={code}
                    aria-invalid={codeError ? true : undefined}
                    aria-describedby={codeError ? 'trim-login-code-error' : undefined}
                    onChange={(event) => {
                      setCode(event.target.value.replace(/\D/g, '').slice(0, 6));
                      setCodeError(null);
                    }}
                  />
                </label>

                {codeError ? (
                  <p className="trim-login__notice" id="trim-login-code-error" role="alert">
                    {codeError}
                  </p>
                ) : null}

                <button
                  className="trim-login__submit"
                  type="submit"
                  disabled={isBusy || code.length !== 6}
                >
                  {isBusy ? 'Checking' : 'Verify and continue'}
                </button>
              </form>

              {resendNote ? (
                <p className="trim-login__notice" role="status">
                  {resendNote}
                </p>
              ) : null}

              <div className="trim-login__verify-actions">
                <button
                  className="trim-login__link"
                  type="button"
                  onClick={handleResend}
                  disabled={isBusy}
                >
                  Send it again
                </button>
                <button className="trim-login__link" type="button" onClick={backToSignIn}>
                  Use a different email
                </button>
              </div>
            </div>
          ) : tab === 'signin' ? (
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
                <span className="trim-login__field-label">Username</span>
                <input
                  className="trim-login__input"
                  type="text"
                  autoComplete="username"
                  value={username}
                  aria-invalid={errors.username ? true : undefined}
                  onChange={(event) => {
                    // Normalised as they type so the field matches the rule it
                    // will be checked against, rather than rejecting input.
                    setUsername(normaliseUsername(event.target.value));
                    setErrors((current) => ({ ...current, username: undefined }));
                  }}
                />
                {errors.username ? (
                  <span className="trim-login__field-error">{errors.username}</span>
                ) : (
                  <span className="trim-login__field-hint">
                    Lowercase letters, numbers and underscores.
                  </span>
                )}
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