import { useEffect, useState } from 'react';

import { useAuth } from '../../auth/AuthProvider';
import { isCustomAvatar } from '../../auth/avatars';
import type { AvatarOption } from '../../auth/avatars';
import AvatarPicker from './AvatarPicker';
import './AvatarCard.css';

/**
 * Account editor for the avatar. One card serves customers, barbers and admins
 * so the same six choices and the same save path are used on every dashboard.
 */
const AvatarCard: React.FC = () => {
  const { profile, saveAvatar } = useAuth();

  const currentAvatar = profile?.avatarUrl ?? null;
  const currentCustom = isCustomAvatar(currentAvatar) ? currentAvatar : null;
  const [selected, setSelected] = useState<string | null>(currentCustom);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  // A save updates the context, so the card follows the stored value rather
  // than keeping a stale draft after the modal or another surface changes it.
  useEffect(() => {
    setSelected(currentCustom);
  }, [currentCustom]);

  const isDirty = Boolean(selected && selected !== currentCustom);
  const initial = (profile?.username ?? profile?.displayName ?? '?')
    .charAt(0)
    .toUpperCase();

  const handleSelect = (option: AvatarOption) => {
    setSelected(option.src);
    setError(null);
    setStatus(null);
  };

  const handleSave = async () => {
    if (!selected || isSaving || !isDirty) return;

    setIsSaving(true);
    setError(null);
    setStatus(null);

    const result = await saveAvatar(selected);

    setIsSaving(false);

    if (!result.ok) {
      setError(result.error ?? 'Could not save your avatar. Try again.');
      return;
    }

    setStatus('Avatar updated.');
  };

  return (
    <div className="trim-card trim-avatar-card">
      <h2 className="trim-card__title">Avatar</h2>

      <div className="trim-avatar-card__current">
        <span className="trim-avatar-card__preview">
          {currentAvatar ? (
            <img src={currentAvatar} alt="Your current avatar" />
          ) : (
            <span aria-hidden="true">{initial}</span>
          )}
        </span>

        <p className="trim-card__text">
          {currentAvatar
            ? isCustomAvatar(currentAvatar)
              ? 'This is the face shown across Trim. Pick another below to change it.'
              : 'You are using the photo from your Google account. Pick a Trim avatar below to replace it.'
            : 'Pick the face that will stand for you across Trim.'}
        </p>
      </div>

      <AvatarPicker
        selectedUrl={selected}
        onSelect={handleSelect}
        disabled={isSaving}
      />

      {error ? (
        <p className="trim-avatar-card__error" role="alert">
          {error}
        </p>
      ) : null}

      {status ? (
        <p className="trim-avatar-card__status" role="status">
          {status}
        </p>
      ) : null}

      <button
        className="trim-avatar-card__save"
        type="button"
        disabled={!isDirty || isSaving}
        onClick={handleSave}
      >
        {isSaving ? 'Saving…' : 'Save avatar'}
      </button>
    </div>
  );
};

export default AvatarCard;
