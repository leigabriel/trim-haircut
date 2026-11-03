import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import {
  MAX_PASSWORD_LENGTH,
  MIN_PASSWORD_LENGTH,
  validateConfirmation,
  validateEmail,
  validatePassword,
} from '../../../auth/credentials';
import {
  DISPLAY_NAME_MAX_LENGTH,
  validateDisplayName,
} from '../../../auth/displayName';
import {
  toUsernameInput,
  USERNAME_MAX_LENGTH,
  USERNAME_MIN_LENGTH,
  validateUsername,
} from '../../../auth/username';
import type { CreateBarberInput, CreateBarberResult } from '../useAccounts';
import './AddBarberModal.css';

interface AddBarberModalProps {
  isOpen: boolean;
  onDismiss: () => void;
  onCreate: (input: CreateBarberInput) => Promise<CreateBarberResult>;
  onCreated: (displayName: string) => void;
}

type FormErrors = {
  displayName?: string;
  username?: string;
  email?: string;
  password?: string;
  confirmation?: string;
};

/**
 * Admin-only barber provisioning form.
 *
 * The actual auth user is created by the create-barber Edge Function. This
 * dialog only validates the shape of the input; the function re-checks every
 * field and verifies that the caller is an administrator before using the
 * service role.
 */
const AddBarberModal: React.FC<AddBarberModalProps> = ({
  isOpen,
  onDismiss,
  onCreate,
  onCreated,
}) => {
  const uid = useId();
  const nameId = `${uid}-name`;
  const usernameId = `${uid}-username`;
  const emailId = `${uid}-email`;
  const passwordId = `${uid}-password`;
  const confirmationId = `${uid}-confirmation`;
  const nameRef = useRef<HTMLInputElement>(null);

  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Every open starts empty. Reusing the last draft after a cancellation would
  // make it too easy to submit the previous person's details.
  useEffect(() => {
    if (!isOpen) return;
    setDisplayName('');
    setUsername('');
    setEmail('');
    setPassword('');
    setConfirmation('');
    setErrors({});
    setFormError(null);
    setIsSaving(false);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    nameRef.current?.focus();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || isSaving) return;
      onDismiss();
    };

    document.addEventListener('keydown', handleKeyDown);

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen, isSaving, onDismiss]);

  if (!isOpen) return null;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (isSaving) return;

    const nextErrors: FormErrors = {};

    const nameResult = validateDisplayName(displayName);
    if (!nameResult.ok) nextErrors.displayName = nameResult.error;

    const usernameResult = validateUsername(username);
    if (!usernameResult.ok) nextErrors.username = usernameResult.error;

    const emailResult = validateEmail(email);
    if (!emailResult.ok) nextErrors.email = emailResult.error;

    const passwordResult = validatePassword(password);
    if (!passwordResult.ok) nextErrors.password = passwordResult.error;

    const confirmationResult = validateConfirmation(password, confirmation);
    if (!confirmationResult.ok) nextErrors.confirmation = confirmationResult.error;

    setErrors(nextErrors);

    if (
      !nameResult.ok ||
      !usernameResult.ok ||
      !emailResult.ok ||
      !passwordResult.ok ||
      !confirmationResult.ok
    ) {
      return;
    }

    setIsSaving(true);
    setFormError(null);

    try {
      const result = await onCreate({
        displayName: nameResult.value,
        username: usernameResult.value,
        email: emailResult.value,
        password: passwordResult.value,
      });

      if (!result.ok) {
        setIsSaving(false);

        if (result.field) {
          const field = result.field;
          setErrors((current) => ({ ...current, [field]: result.error }));
        } else {
          setFormError(result.error);
        }
        return;
      }

      onCreated(nameResult.value);
    } catch {
      setIsSaving(false);
      setFormError('Could not create the barber account. Try again.');
    }
  };

  return createPortal(
    <div className="trim-barber-modal" role="presentation">
      <div
        className="trim-barber-modal__scrim"
        aria-hidden="true"
        onClick={() => {
          if (!isSaving) onDismiss();
        }}
      />

      <div
        className="trim-barber-modal__card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="trim-barber-modal-title"
        aria-describedby="trim-barber-modal-lede"
        aria-busy={isSaving}
      >
        <p className="trim-barber-modal__eyebrow">Barber Manager</p>

        <h2 className="trim-barber-modal__title" id="trim-barber-modal-title">
          Add a barber
        </h2>

        <p className="trim-barber-modal__lede" id="trim-barber-modal-lede">
          Create the sign-in and profile for a new barber. They sign in with
          this email and password on the barber dashboard.
        </p>

        <form className="trim-barber-modal__form" onSubmit={handleSubmit} noValidate>
          <div className="trim-barber-modal__field">
            <label className="trim-barber-modal__label" htmlFor={nameId}>
              Name
            </label>
            <input
              ref={nameRef}
              id={nameId}
              className="trim-barber-modal__input"
              type="text"
              value={displayName}
              maxLength={DISPLAY_NAME_MAX_LENGTH}
              autoComplete="name"
              placeholder="e.g. Juan dela Cruz"
              disabled={isSaving}
              aria-invalid={errors.displayName ? true : undefined}
              aria-describedby={`${nameId}-hint${
                errors.displayName ? ` ${nameId}-error` : ''
              }`}
              onChange={(event) => {
                setDisplayName(event.target.value);
                setErrors((current) => ({ ...current, displayName: undefined }));
                setFormError(null);
              }}
            />
            <p className="trim-barber-modal__hint" id={`${nameId}-hint`}>
              Shown on their profile and on customer bookings.
            </p>
            {errors.displayName ? (
              <p className="trim-barber-modal__field-error" id={`${nameId}-error`}>
                {errors.displayName}
              </p>
            ) : null}
          </div>

          <div className="trim-barber-modal__field">
            <label className="trim-barber-modal__label" htmlFor={usernameId}>
              Username
            </label>
            <input
              id={usernameId}
              className="trim-barber-modal__input"
              type="text"
              value={username}
              maxLength={USERNAME_MAX_LENGTH}
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              placeholder="e.g. juan_barber"
              disabled={isSaving}
              aria-invalid={errors.username ? true : undefined}
              aria-describedby={`${usernameId}-hint${
                errors.username ? ` ${usernameId}-error` : ''
              }`}
              onChange={(event) => {
                setUsername(toUsernameInput(event.target.value));
                setErrors((current) => ({ ...current, username: undefined }));
                setFormError(null);
              }}
            />
            <p className="trim-barber-modal__hint" id={`${usernameId}-hint`}>
              Their handle. {USERNAME_MIN_LENGTH}–{USERNAME_MAX_LENGTH}{' '}
              characters: lowercase letters, numbers and underscores.
            </p>
            {errors.username ? (
              <p className="trim-barber-modal__field-error" id={`${usernameId}-error`}>
                {errors.username}
              </p>
            ) : null}
          </div>

          <div className="trim-barber-modal__field">
            <label className="trim-barber-modal__label" htmlFor={emailId}>
              Email
            </label>
            <input
              id={emailId}
              className="trim-barber-modal__input"
              type="email"
              value={email}
              autoComplete="email"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              placeholder="barber@example.com"
              disabled={isSaving}
              aria-invalid={errors.email ? true : undefined}
              aria-describedby={errors.email ? `${emailId}-error` : undefined}
              onChange={(event) => {
                setEmail(event.target.value);
                setErrors((current) => ({ ...current, email: undefined }));
                setFormError(null);
              }}
            />
            {errors.email ? (
              <p className="trim-barber-modal__field-error" id={`${emailId}-error`}>
                {errors.email}
              </p>
            ) : null}
          </div>

          <div className="trim-barber-modal__field">
            <label className="trim-barber-modal__label" htmlFor={passwordId}>
              Password
            </label>
            <input
              id={passwordId}
              className="trim-barber-modal__input"
              type="password"
              value={password}
              autoComplete="new-password"
              disabled={isSaving}
              aria-invalid={errors.password ? true : undefined}
              aria-describedby={`${passwordId}-hint${
                errors.password ? ` ${passwordId}-error` : ''
              }`}
              onChange={(event) => {
                setPassword(event.target.value);
                setErrors((current) => ({
                  ...current,
                  password: undefined,
                  confirmation: undefined,
                }));
                setFormError(null);
              }}
            />
            <p className="trim-barber-modal__hint" id={`${passwordId}-hint`}>
              {MIN_PASSWORD_LENGTH}–{MAX_PASSWORD_LENGTH} characters, no spaces.
            </p>
            {errors.password ? (
              <p className="trim-barber-modal__field-error" id={`${passwordId}-error`}>
                {errors.password}
              </p>
            ) : null}
          </div>

          <div className="trim-barber-modal__field">
            <label className="trim-barber-modal__label" htmlFor={confirmationId}>
              Confirm password
            </label>
            <input
              id={confirmationId}
              className="trim-barber-modal__input"
              type="password"
              value={confirmation}
              autoComplete="new-password"
              disabled={isSaving}
              aria-invalid={errors.confirmation ? true : undefined}
              aria-describedby={
                errors.confirmation ? `${confirmationId}-error` : undefined
              }
              onChange={(event) => {
                setConfirmation(event.target.value);
                setErrors((current) => ({ ...current, confirmation: undefined }));
                setFormError(null);
              }}
            />
            {errors.confirmation ? (
              <p className="trim-barber-modal__field-error" id={`${confirmationId}-error`}>
                {errors.confirmation}
              </p>
            ) : null}
          </div>

          {formError ? (
            <p className="trim-barber-modal__error" role="alert">
              {formError}
            </p>
          ) : null}

          <div className="trim-barber-modal__actions">
            <button
              className="trim-barber-modal__cancel"
              type="button"
              disabled={isSaving}
              onClick={onDismiss}
            >
              Cancel
            </button>

            <button
              className="trim-barber-modal__save"
              type="submit"
              disabled={isSaving}
            >
              {isSaving ? 'Creating…' : 'Create barber'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
};

export default AddBarberModal;
