import { useEffect, useMemo, useState } from 'react';

import AddPasswordModal from './AddPasswordModal';
import { useAuth } from './AuthProvider';

const DISMISS_KEY_PREFIX = 'trim.password-setup-dismissed.';

const PasswordSetupPrompt: React.FC = () => {
  const { session, isProfileReady, hasPassword } = useAuth();
  const [open, setOpen] = useState(false);

  const userId = session?.user.id ?? null;
  const providers = (session?.user.app_metadata?.providers as string[] | undefined) ?? [];
  const identities = session?.user.identities ?? [];
  const isGoogleUser = providers.includes('google') || identities.some((identity) => identity.provider === 'google');
  const isEmailUser = providers.includes('email') || identities.some((identity) => identity.provider === 'email');
  const dismissKey = useMemo(() => (userId ? `${DISMISS_KEY_PREFIX}${userId}` : null), [userId]);

  useEffect(() => {
    // Only Google sign-in users without an email/password identity should get
    // this prompt. Manually created email/password accounts must not see it.
    const shouldPrompt = Boolean(
      session && isProfileReady && userId && isGoogleUser && !isEmailUser && !hasPassword && dismissKey,
    );
    if (!shouldPrompt || !dismissKey) {
      setOpen(false);
      return;
    }
    const dismissed = window.localStorage.getItem(dismissKey) === '1';
    setOpen(!dismissed);
  }, [dismissKey, hasPassword, isEmailUser, isGoogleUser, isProfileReady, session, userId]);

  if (!open || !dismissKey) return null;

  return (
    <AddPasswordModal
      isOpen={open}
      allowLater
      onDismiss={() => {
        window.localStorage.setItem(dismissKey, '1');
        setOpen(false);
      }}
      onSaved={() => {
        window.localStorage.setItem(dismissKey, '1');
        setOpen(false);
      }}
    />
  );
};

export default PasswordSetupPrompt;
