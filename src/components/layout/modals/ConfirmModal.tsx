import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import './ConfirmModal.css';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  /**
   * When set, the customer has to type this exact text before the confirm
   * button enables. For actions that cannot be undone, a stray Enter on a
   * two-button dialog is not enough of a barrier.
   */
  verifyText?: string;
  /**
   * Shown on the confirm button while it is waiting on onConfirm. The work is
   * irreversible and slow, so the button has to say so: without it the dialog
   * looks identical before and during the request, and the customer clicks
   * again.
   */
  pendingLabel?: string;
  /**
   * A failed confirm leaves the dialog open so the caller can show why. The
   * message is owned by the caller and cleared when the dialog closes.
   */
  error?: string | null;
  /** May be async. The dialog stays open and disabled until it settles. */
  onConfirm: () => void | Promise<void>;
  onDismiss: () => void;
}

/**
 * Confirmation for an action that is easy to undo by accident and awkward to
 * undo deliberately. Generic on purpose: the same dialog covers deleting a
 * conversation and deleting the account.
 *
 * Portalled to document.body rather than using IonModal. Inside the modal the
 * panel was laid out inside Ionic's wrapper, which carries a transform, and a
 * transformed ancestor becomes the containing block for position:fixed. That
 * is what kept the card off centre no matter how the panel was styled.
 *
 * Focus starts on Cancel, not Confirm. For a destructive action the safe
 * choice should be the one a stray Enter key hits.
 */
const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  message,
  confirmLabel,
  cancelLabel = 'Cancel',
  verifyText,
  pendingLabel,
  error,
  onConfirm,
  onDismiss,
}) => {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const [typed, setTyped] = useState('');
  // Owned here rather than passed in, so a dialog cannot be left permanently
  // disabled by a caller that forgets to clear its own flag.
  const [isWorking, setIsWorking] = useState(false);

  const needsVerify = typeof verifyText === 'string';
  const canConfirm = !isWorking && (!needsVerify || typed.trim() === verifyText);

  // Cleared on close so a half-typed confirmation does not survive a reopen.
  useEffect(() => {
    if (!isOpen) setTyped('');
  }, [isOpen]);

  // An unmount mid-flight (the customer navigates away) must not warn about a
  // state update on a component that is gone.
  useEffect(() => {
    if (!isOpen) setIsWorking(false);
  }, [isOpen]);

  const handleConfirm = async () => {
    // Guarded rather than relying on the disabled attribute: a queued click or
    // an Enter keypress in the verify field can both land in the same tick.
    if (isWorking || !canConfirm) return;

    setIsWorking(true);
    try {
      await onConfirm();
    } catch {
      // The caller's own message is the useful one. Swallowing here keeps the
      // dialog usable instead of stranding it disabled.
    } finally {
      setIsWorking(false);
    }
  };

  // Focus and the key listener are separate effects on purpose. Folding
  // isWorking into the same dependency list as the initial focus would re-run
  // that focus every time the button state flips, fighting the customer for
  // focus mid-operation.
  useEffect(() => {
    if (!isOpen) return;
    cancelRef.current?.focus();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      // Escape cannot abandon a delete that is already running.
      if (isWorking) return;
      onDismiss();
    };

    document.addEventListener('keydown', handleKeyDown);

    // The page behind must not scroll under the dialog.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen, onDismiss, isWorking]);

  if (!isOpen) return null;

  return createPortal(
    <div className="trim-confirm" role="presentation">
      <div
        className="trim-confirm__scrim"
        onClick={() => {
          if (!isWorking) onDismiss();
        }}
        aria-hidden="true"
      />

      <div
        className="trim-confirm__card"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="trim-confirm-title"
        aria-describedby="trim-confirm-message"
        aria-busy={isWorking}
      >
        <h2 className="trim-confirm__title" id="trim-confirm-title">
          {title}
        </h2>

        <p className="trim-confirm__message" id="trim-confirm-message">
          {message}
        </p>

        {needsVerify ? (
          <div className="trim-confirm__verify">
            <label className="trim-confirm__verify-label" htmlFor="trim-confirm-verify">
              Type <strong>{verifyText}</strong> to confirm
            </label>
            <input
              id="trim-confirm-verify"
              className="trim-confirm__verify-input"
              type="text"
              value={typed}
              autoComplete="off"
              spellCheck={false}
              disabled={isWorking}
              onChange={(event) => setTyped(event.target.value)}
            />
          </div>
        ) : null}

        {error ? (
          <p className="trim-confirm__error" role="alert">
            {error}
          </p>
        ) : null}

        <div className="trim-confirm__actions">
          <button
            ref={cancelRef}
            className="trim-confirm__cancel"
            type="button"
            disabled={isWorking}
            onClick={onDismiss}
          >
            {cancelLabel}
          </button>

          <button
            className="trim-confirm__ok"
            type="button"
            disabled={!canConfirm}
            onClick={handleConfirm}
          >
            {isWorking ? (pendingLabel ?? confirmLabel) : confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default ConfirmModal;