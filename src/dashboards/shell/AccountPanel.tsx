import { useAuth } from '../../auth/AuthProvider';
import { roleLabel } from '../../auth/roles';
import SectionHead from './SectionHead';

interface AccountPanelProps {
  /** 'Administrator' or 'Barber'. Customers have their own Account page. */
  role: 'admin' | 'barber';
}

/**
 * Read-only identity card for staff accounts.
 *
 * There is deliberately no name or email editor: staff accounts are
 * provisioned, and the customer Account page's delete flow does not belong on a
 * surface that manages other people's records.
 */
const AccountPanel: React.FC<AccountPanelProps> = ({ role }) => {
  const { session, profile } = useAuth();

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
        lede="The credentials this dashboard is signed in with. Staff accounts are provisioned, so there is nothing to edit here."
      />

      <div className="trim-card">
        <h2 className="trim-card__title">Signed in as</h2>

        <dl className="trim-facts">
          <div>
            <dt>Username</dt>
            <dd>{profile?.username ?? 'Not set'}</dd>
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
      </div>
    </>
  );
};

export default AccountPanel;
