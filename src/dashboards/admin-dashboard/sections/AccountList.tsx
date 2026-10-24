import type { UserRole } from '../../../auth/roles';
import type { StaffAccount } from '../useAccounts';

interface AccountListProps {
  accounts: StaffAccount[];
  /** The account whose change is in flight. */
  pendingId: string | null;
  onChangeRole: (id: string, role: UserRole) => void;
  emptyText: string;
}

const joined = (iso: string): string => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
};

/**
 * Account rows shared by User Manager and Barber Manager. The role select is
 * the only mutation: it calls admin_set_role, which re-checks the caller in the
 * database rather than trusting this component.
 *
 * A table rather than cards: these are records with the same four fields, and
 * the dashboard stylesheet already stacks it into labelled rows on phones.
 */
const AccountList: React.FC<AccountListProps> = ({
  accounts,
  pendingId,
  onChangeRole,
  emptyText,
}) => {
  if (accounts.length === 0) {
    return <p className="trim-card__text">{emptyText}</p>;
  }

  return (
    <div className="trim-table-wrap">
      <table className="trim-table">
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

            return (
              <tr key={account.id}>
                <td data-label="Account">
                  <span className="trim-table__primary">{name}</span>
                </td>
                <td data-label="Email">{account.email}</td>
                <td data-label="Joined">{joined(account.createdAt)}</td>
                <td data-label="Role">
                  <select
                    className="trim-role-select"
                    value={account.role}
                    disabled={pendingId === account.id}
                    aria-label={`Role for ${name}`}
                    onChange={(event) =>
                      onChangeRole(account.id, event.target.value as UserRole)
                    }
                  >
                    <option value="customer">Customer</option>
                    <option value="barber">Barber</option>
                    <option value="admin">Admin</option>
                  </select>
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
