import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { isCustomAvatar } from '../../../auth/avatars';
import type { AvatarOption } from '../../../auth/avatars';
import AvatarPicker from '../../profile/AvatarPicker';
import './AvatarModal.css';

interface AvatarModalProps {
  isOpen: boolean;
  /** The stored avatar, or null when the account still has the Google photo. */
  initialAvatarUrl: string | null;
  onSave: (avatarUrl: string) => Promise<{ ok: boolean; error?: string }>;
  /** Called after a successful save or an explicit skip. */
  onDone: () => void;
}

/**
 * First-run avatar prompt. Portalled to document.body for the same reason as
 * ConfirmModal: a transformed Ionic ancestor would otherwise become the
 * containing block for the fixed scrim.
 */
const AvatarModal: React.FC<AvatarModalProps> = ({
  isOpen,
  initialAvatarUrl,
  onSave,
  onDone,
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const initial = isCustomAvatar(initialAvatarUrl) ? initialAvatarUrl : null;

  // Reopening starts from what is stored, not from the previous draft.
  useEffect(() => {
    if (!isOpen) return;
    setSelected(initial);
    setIsSaving(false);
    setError(null);
  }, [isOpen, initial]);

  useEffect(() => {
    if (!isOpen) return;
    cardRef.current?.focus();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || isSaving) return;
      onDone();
    };

    document.addEventListener('keydown', handleKeyDown);

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen, isSaving, onDone]);

  if (!isOpen) return null;

  const handleSave = async () => {
    if (!selected || isSaving) return;

    setIsSaving(true);
    setError(null);

    const result = await onSave(selected);

    setIsSaving(false);

    if (!result.ok) {
      setError(result.error ?? 'Could not save your avatar. Try again.');
      return;
    }

    onDone();
  };

  return createPortal(
    <div className="trim-avatar-modal" role="presentation">
      <div
        className="trim-avatar-modal__scrim"
        onClick={() => {
          if (!isSaving) onDone();
        }}
        aria-hidden="true"
      />

      <div
        ref={cardRef}
        className="trim-avatar-modal__card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="trim-avatar-modal-title"
        aria-describedby="trim-avatar-modal-lede"
        aria-busy={isSaving}
        tabIndex={-1}
      >
        <p className="trim-avatar-modal__eyebrow">Your Trim profile</p>

        <h2 className="trim-avatar-modal__title" id="trim-avatar-modal-title">
          Choose your avatar
        </h2>

        <p className="trim-avatar-modal__lede" id="trim-avatar-modal-lede">
          Pick the face that will stand for you across Trim. You can change it
          any time from your account.
        </p>

        <AvatarPicker
          selectedUrl={selected}
          onSelect={(option: AvatarOption) => {
            setSelected(option.src);
            setError(null);
          }}
          disabled={isSaving}
        />

        {error ? (
          <p className="trim-avatar-modal__error" role="alert">
            {error}
          </p>
        ) : null}

        <div className="trim-avatar-modal__actions">
          <button
            className="trim-avatar-modal__skip"
            type="button"
            disabled={isSaving}
            onClick={onDone}
          >
            Skip for now
          </button>

          <button
            className="trim-avatar-modal__save"
            type="button"
            disabled={!selected || isSaving}
            onClick={handleSave}
          >
            {isSaving ? 'Saving…' : 'Save avatar'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default AvatarModal;
