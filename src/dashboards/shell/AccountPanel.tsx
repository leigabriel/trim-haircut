import { useState } from 'react';

import AddPasswordModal from '../../auth/AddPasswordModal';
import { useAuth } from '../../auth/AuthProvider';
import { roleLabel } from '../../auth/roles';
import AvatarCard from '../../components/profile/AvatarCard';
import DisplayNameForm from '../../components/profile/DisplayNameForm';
import SectionHead from './SectionHead';

interface AccountPanelProps {
  /** 'Administrator' or 'Barber'. Customers have their own Account page. */
  role: 'admin' | 'barber';
}

/**
 * Identity card for staff accounts, plus the avatar picker and a one-time name
 * prompt.
 *
 * Email is still read-only: staff accounts are provisioned, and the customer
 * Account page's delete flow does not belong on a surface that manages other
 * people's records. The avatar and a missing display name are the exceptions:
 * both are the caller's own row and are shown throughout their dashboard.
 */
const AccountPanel: React.FC<AccountPanelProps> = ({ role }) => {
  const { session, profile, saveDisplayName, hasPassword } = useAuth();
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [passwordNotice, setPasswordNotice] = useState<string | null>(null);

  const memberSince = session?.user.created_at
    ? new Date(session.user.created_at).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : '—';

  const providers = (session?.user.app_metadata?.providers as string[] | undefined) ?? [];
  const signedInWith = providers.includes('google') && providers.includes('email')
    ? 'Google and password'
    : providers.includes('google')
      ? 'Google'
      : providers.length > 0
        ? providers.join(', ')
        : 'Email and password';

  return (
    <>
      <SectionHead
        title="Account"
        lede="The credentials this dashboard is signed in with, and the avatar shown across Trim. Staff accounts are provisioned; if your name is missing, you can add it below."
      />

      <AvatarCard />

      <div className="trim-card">
        <h2 className="trim-card__title">Signed in as</h2>

        <dl className="trim-facts">
          <div>
            <dt>Username</dt>
            <dd>{profile?.username ?? 'Not set'}</dd>
          </div>
          <div>
            <dt>Name</dt>
            <dd>{profile?.displayName?.trim() || 'Not provided'}</dd>
          </div>
          <div>
            <dt>Role</dt>
            <dd>{roleLabel(role)}</dd>
          </div>
          <div className="trim-facts__wide">
            <dt>Email</dt>
            <dd>{session?.user.email ?? '—'}</dd>
          </div>
          <div>
            <dt>Signed in with</dt>
            <dd>{signedInWith}</dd>
          </div>
          <div>
            <dt>Member since</dt>
            <dd>{memberSince}</dd>
          </div>
        </dl>

        {profile && !profile.displayName?.trim() ? (
          <DisplayNameForm onSave={saveDisplayName} />
        ) : null}
      </div>

      <div className="trim-card">
        <h2 className="trim-card__title">Password</h2>
        <p className="trim-card__text">
          {hasPassword
            ? 'You can sign in with your email and password.'
            : 'Add a password so you can also sign in with your email and password.'}
        </p>
        {passwordNotice ? <p className="trim-card__text" role="status">{passwordNotice}</p> : null}
        <button
          className="trim-account__analyze"
          type="button"
          onClick={() => {
            setPasswordNotice(null);
            setIsPasswordModalOpen(true);
          }}
        >
          {hasPassword ? 'Change password' : 'Add password'}
        </button>
      </div>

      <AddPasswordModal
        isOpen={isPasswordModalOpen}
        allowLater={false}
        onDismiss={() => setIsPasswordModalOpen(false)}
        onSaved={() => setPasswordNotice('Password saved. You can now sign in with email and password.')}
      />
    </>
  );
};

export default AccountPanel;
