import { useMemo } from 'react';

import type { AccountsState } from '../useAccounts';
import AccountManager from './AccountManager';

interface UsersProps {
  accounts: AccountsState;
}

/**
 * Customer and administrator accounts, with the role read-only.
 *
 * Barbers live on their own page, so no account row appears in both managers
 * and the same table is not repeated. A barber promoted from Barber Manager
 * moves into this list, which is the visible result of the change.
 *
 * Role is read-only here on purpose: User Manager is the directory, not the
 * place to grant access. Barber Manager owns that switch, which keeps the
 * promotion path in one place.
 */
const Users: React.FC<UsersProps> = ({ accounts }) => {
  const users = useMemo(
    () => accounts.accounts.filter((account) => account.role !== 'barber'),
    [accounts.accounts],
  );

  return (
    <AccountManager
      title="User Manager"
      lede="Customer and administrator accounts with their avatar, contact address, join date and role. Roles are fixed here; promote a barber from Barber Manager."
      accounts={users}
      isLoading={accounts.isLoading}
      error={accounts.error}
      onReload={() => void accounts.reload()}
      noun="accounts"
      emptyText="No customer or administrator accounts yet."
      noMatchText="No account matches that search."
      searchPlaceholder="Search by name, email or role"
      errorTitle="Account list unavailable"
      loadingLabel="Reading accounts…"
      loadingText="Reading the profiles table…"
      avatarsAvailable={!accounts.avatarColumnMissing}
    />
  );
};

export default Users;
