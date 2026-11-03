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
  const { session, profile, saveDisplayName } = useAuth();

  const memberSince = session?.user.created_at
    ? new Date(session.user.created_at).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : '—';

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
            <dt>Member since</dt>
            <dd>{memberSince}</dd>
          </div>
        </dl>

        {profile && !profile.displayName?.trim() ? (
          <DisplayNameForm onSave={saveDisplayName} />
        ) : null}
      </div>
    </>
  );
};

export default AccountPanel;
