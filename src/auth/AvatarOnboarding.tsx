import { useCallback, useEffect, useState } from 'react';

import AvatarModal from '../components/layout/modals/AvatarModal';
import { useAuth } from './AuthProvider';
import { isCustomAvatar } from './avatars';

/**
 * Prompts for an avatar once per sign-in.
 *
 * It waits for a username so a new account still sees "What should we call
 * you?" first; the prompt then opens on the dashboard after that form is saved.
 * `promptedFor` is cleared on sign-out, so a different sign-in asks again until
 * an avatar is actually stored. Returning accounts with a Google photo also
 * qualify, which is what makes the prompt reach every role rather than just new
 * customers.
 */
const AvatarOnboarding: React.FC = () => {
  const { session, profile, isProfileReady, saveAvatar } = useAuth();
  const userId = session?.user.id ?? null;
  const [promptedFor, setPromptedFor] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) setPromptedFor(null);
  }, [userId]);

  const shouldPrompt = Boolean(
    userId &&
      profile?.username &&
      isProfileReady &&
      !isCustomAvatar(profile.avatarUrl),
  );

  const isOpen = shouldPrompt && promptedFor !== userId;

  const handleDone = useCallback(() => {
    if (userId) setPromptedFor(userId);
  }, [userId]);

  return (
    <AvatarModal
      isOpen={isOpen}
      initialAvatarUrl={profile?.avatarUrl ?? null}
      onSave={saveAvatar}
      onDone={handleDone}
    />
  );
};

export default AvatarOnboarding;
