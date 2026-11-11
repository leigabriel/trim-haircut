import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

import '../dashboards/booking/booking.css';
import { useAuth } from './AuthProvider';

interface AddPasswordModalProps {
  isOpen: boolean;
  allowLater?: boolean;
  onDismiss: () => void;
  onSaved?: () => void;
}

const AddPasswordModal: React.FC<AddPasswordModalProps> = ({
  isOpen,
  allowLater = false,
  onDismiss,
  onSaved,
}) => {
  const { setPassword } = useAuth();
  const [password, setPasswordValue] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setPasswordValue('');
    setConfirmation('');
    setError(null);
    setIsSaving(false);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isSaving) onDismiss();
    };
    document.addEventListener('keydown', onKeyDown);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previous;
    };
  }, [isOpen, isSaving, onDismiss]);

  if (!isOpen) return null;

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
      setError(result.error ?? 'Could not save password.');
      return;
    }
    onSaved?.();
    onDismiss();
  };

  return createPortal(
    <div className="trim-book-modal" role="presentation">
      <div
        className="trim-book-modal__scrim"
        aria-hidden="true"
        onClick={() => {
          if (!isSaving) onDismiss();
        }}
      />
      <div className="trim-book-modal__card" role="dialog" aria-modal="true" aria-labelledby="trim-add-password-title">
        <header className="trim-book-modal__head">
          <div>
            <p className="trim-book-modal__eyebrow">Account security</p>
            <h2 className="trim-book-modal__title" id="trim-add-password-title">Add a password</h2>
            <p className="trim-book-modal__lede">
              You signed in with Google. Add a password so you can also sign in with your email and password.
            </p>
          </div>
          <button
            type="button"
            className="trim-book-modal__close"
            aria-label="Close"
            disabled={isSaving}
            onClick={onDismiss}
          >
            <span aria-hidden="true">×</span>
          </button>
        </header>

        <form className="trim-book-form" onSubmit={submit} noValidate>
          <div className="trim-book-form__grid">
            <label className="trim-book-field trim-book-field--wide">
              <span className="trim-book-field__label">New password</span>
              <input
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPasswordValue(event.target.value)}
                disabled={isSaving}
              />
            </label>
            <label className="trim-book-field trim-book-field--wide">
              <span className="trim-book-field__label">Confirm password</span>
              <input
                type="password"
                autoComplete="new-password"
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                disabled={isSaving}
              />
            </label>
          </div>

          {error ? <p className="trim-book-form__error" role="alert">{error}</p> : null}

          <div className="trim-book-form__actions">
            <button type="button" className="trim-book-form__cancel" disabled={isSaving} onClick={onDismiss}>
              {allowLater ? 'Later' : 'Cancel'}
            </button>
            <button type="submit" className="trim-book-form__submit" disabled={isSaving}>
              {isSaving ? 'Saving…' : 'Save password'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
};

export default AddPasswordModal;
