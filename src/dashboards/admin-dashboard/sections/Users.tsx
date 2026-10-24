import { useMemo, useState } from 'react';

import type { UserRole } from '../../../auth/roles';
import SectionHead from '../../shell/SectionHead';
import type { AccountsState } from '../useAccounts';
import AccountList from './AccountList';

interface UsersProps {
  accounts: AccountsState;
}

/**
 * Every account, with the role select as the only write.
 *
 * Search filters what is already loaded rather than querying per keystroke:
 * the list is one call from admin_list_accounts, and re-fetching it while the
 * admin types would be slower and rate-limit prone.
 */
const Users: React.FC<UsersProps> = ({ accounts }) => {
  const [query, setQuery] = useState('');
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return accounts.accounts;

    return accounts.accounts.filter((account) =>
      [account.username ?? '', account.displayName ?? '', account.email, account.role]
        .some((field) => field.toLowerCase().includes(needle)),
    );
  }, [accounts.accounts, query]);

  const changeRole = async (id: string, role: UserRole) => {
    setPendingId(id);
    setSaveError(null);

    const result = await accounts.setRole(id, role);
    if (!result.ok) setSaveError(result.error);

    setPendingId(null);
  };

  return (
    <>
      <SectionHead
        title="User Manager"
        lede="Every account on Trim. Changing a role takes effect on the account's next dashboard load, and admin accounts cannot demote themselves."
      />

      {accounts.error ? (
        <div className="trim-card trim-card--danger">
          <h2 className="trim-card__title">Account list unavailable</h2>
          <p className="trim-card__text">{accounts.error}</p>
          <button
            className="trim-account__analyze"
            type="button"
            onClick={() => void accounts.reload()}
          >
            Try again
          </button>
        </div>
      ) : null}

      {saveError ? (
        <div className="trim-card trim-card--danger">
          <h2 className="trim-card__title">Role not changed</h2>
          <p className="trim-card__text">{saveError}</p>
        </div>
      ) : null}

      <label className="trim-search">
        <span className="trim-visually-hidden">Search accounts</span>
        <input
          className="trim-search__input"
          type="search"
          placeholder="Search by name, email or role"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>

      <div className="trim-card">
        <h2 className="trim-card__title">
          {accounts.isLoading ? 'Reading accounts…' : `${filtered.length} accounts`}
        </h2>

        {accounts.isLoading ? (
          <p className="trim-card__text">Reading the profiles table…</p>
        ) : (
          <AccountList
            accounts={filtered}
            pendingId={pendingId}
            onChangeRole={(id, role) => void changeRole(id, role)}
            emptyText={
              accounts.accounts.length === 0
                ? 'No accounts yet.'
                : 'No account matches that search.'
            }
          />
        )}
      </div>
    </>
  );
};

export default Users;
