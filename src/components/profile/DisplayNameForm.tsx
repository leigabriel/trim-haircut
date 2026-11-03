import { useId, useState } from 'react';

import {
  DISPLAY_NAME_MAX_LENGTH,
  validateDisplayName,
} from '../../auth/displayName';
import './DisplayNameForm.css';

interface DisplayNameFormProps {
  onSave: (name: string) => Promise<{ ok: boolean; error?: string }>;
}

/**
 * Inline editor for an account whose profile has no display name yet.
 *
 * The parent removes this form once the profile state has a name, so a
 * successful save is the only unmount path. The button stays in its pending
 * state until that happens rather than flashing back to "Save name".
 */
const DisplayNameForm: React.FC<DisplayNameFormProps> = ({ onSave }) => {
  const id = useId();
  const inputId = `${id}-name`;
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;

  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const canSave = name.trim().length > 0 && !isSaving;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (isSaving) return;

    const result = validateDisplayName(name);
    if (!result.ok) {
      setError(result.error);
      return;
    }

    setError(null);
    setIsSaving(true);

    try {
      const saved = await onSave(result.value);

      if (!saved.ok) {
        setIsSaving(false);
        setError(saved.error ?? 'Could not save your name. Try again.');
      }
    } catch {
      setIsSaving(false);
      setError('Could not save your name. Try again.');
    }
  };

  return (
    <form className="trim-name-form" onSubmit={handleSubmit} noValidate>
      <h3 className="trim-name-form__title">Add your name</h3>
      <p className="trim-name-form__lede">
        Your profile does not have a name yet. Add the name you want shown on
        your account.
      </p>

      <label className="trim-name-form__label" htmlFor={inputId}>
        Name
      </label>

      <div className="trim-name-form__row">
        <input
          id={inputId}
          className="trim-name-form__input"
          type="text"
          value={name}
          maxLength={DISPLAY_NAME_MAX_LENGTH}
          autoComplete="name"
          placeholder="e.g. Juan dela Cruz"
          disabled={isSaving}
          aria-invalid={error ? true : undefined}
          aria-describedby={`${hintId}${error ? ` ${errorId}` : ''}`}
          onChange={(event) => {
            setName(event.target.value);
            setError(null);
          }}
        />

        <button
          className="trim-name-form__save"
          type="submit"
          disabled={!canSave}
        >
          {isSaving ? 'Saving…' : 'Save name'}
        </button>
      </div>

      <p className="trim-name-form__hint" id={hintId}>
        This is how your name appears on your profile.
      </p>

      {error ? (
        <p className="trim-name-form__error" id={errorId} role="alert">
          {error}
        </p>
      ) : null}
    </form>
  );
};

export default DisplayNameForm;
