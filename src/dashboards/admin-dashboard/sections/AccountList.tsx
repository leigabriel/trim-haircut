import { roleLabel } from '../../../auth/roles';
import type { UserRole } from '../../../auth/roles';
import type { StaffAccount } from '../useAccounts';
import AccountAvatar from '../AccountAvatar';

interface AccountListProps {
  accounts: StaffAccount[];
  /** The account whose change is in flight. Only meaningful when editable. */
  pendingId?: string | null;
  /**
   * When provided, the role column becomes a select. User Manager omits it so
   * the role is fixed there; Barber Manager passes it to promote a barber.
   */
  onChangeRole?: (id: string, role: UserRole) => void;
  /** Roles offered by the editable control. Defaults to all three. */
  roleOptions?: readonly UserRole[];
  emptyText: string;
}

const ALL_ROLES: readonly UserRole[] = ['customer', 'barber', 'admin'];

const ROLE_LABELS: Record<UserRole, string> = {
  customer: 'Customer',
  barber: 'Barber',
  admin: 'Admin',
};

const joined = (iso: string): string => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
};

/**
 * Account rows shared by User Manager and Barber Manager. The avatar and the
 * read-only role badge are always shown; the role select is only rendered when
 * the section allows a write.
 *
 * A table rather than cards: these are records with the same five fields, and
 * the dashboard stylesheet already stacks it into labelled rows on phones.
 */
const AccountList: React.FC<AccountListProps> = ({
  accounts,
  pendingId = null,
  onChangeRole,
  roleOptions = ALL_ROLES,
  emptyText,
}) => {
  if (accounts.length === 0) {
    return <p className="trim-card__text">{emptyText}</p>;
  }

  return (
    <div className="trim-table-wrap">
      <table className="trim-table">
        <caption className="trim-visually-hidden">
          Accounts with their avatar, email, join date and role
        </caption>

        <thead>
          <tr>
            <th scope="col">Account</th>
            <th scope="col">Email</th>
            <th scope="col">Joined</th>
            <th scope="col">Role</th>
          </tr>
        </thead>

        <tbody>
          {accounts.map((account) => {
            const name = account.username ?? account.displayName ?? 'No username';
            const secondary =
              account.username && account.displayName ? account.displayName : null;

            return (
              <tr key={account.id}>
                <td data-label="Account">
                  <span className="trim-admin-account">
                    <AccountAvatar
                      src={account.avatarUrl}
                      name={name}
                      className="trim-avatar--row"
                    />

                    <span className="trim-admin-account__text">
                      <span className="trim-table__primary">{name}</span>
                      {secondary ? (
                        <span className="trim-table__secondary">{secondary}</span>
                      ) : null}
                    </span>
                  </span>
                </td>

                <td data-label="Email" className="trim-admin-email">
                  {account.email}
                </td>
                <td data-label="Joined">{joined(account.createdAt)}</td>

                <td data-label="Role">
                  {onChangeRole ? (
                    <select
                      className="trim-role-select"
                      value={account.role}
                      disabled={pendingId === account.id}
                      aria-label={`Role for ${name}`}
                      onChange={(event) =>
                        onChangeRole(account.id, event.target.value as UserRole)
                      }
                    >
                      {roleOptions.map((role) => (
                        <option key={role} value={role}>
                          {ROLE_LABELS[role]}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className={`trim-role-badge trim-role-badge--${account.role}`}>
                      {roleLabel(account.role)}
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default AccountList;
