import { useMemo, useState } from 'react';

import type { UserRole } from '../../../auth/roles';
import type { AccountsState } from '../useAccounts';
import AccountManager from './AccountManager';

interface BarbersProps {
  accounts: AccountsState;
}

/** Barber Manager can promote a barber, but cannot demote one to customer. */
const BARBER_ROLE_OPTIONS: readonly UserRole[] = ['barber', 'admin'];

/**
 * The barber subset, with the role select the User Manager intentionally omits.
 * This is the one place an administrator promotes a barber; the database
 * re-checks the caller in admin_set_role.
 *
 * A promoted barber leaves this list and appears in User Manager, so the two
 * pages never show the same account twice.
 */
const Barbers: React.FC<BarbersProps> = ({ accounts }) => {
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const barbers = useMemo(
    () => accounts.accounts.filter((account) => account.role === 'barber'),
    [accounts.accounts],
  );

  const changeRole = async (id: string, role: UserRole) => {
    const account = accounts.accounts.find((entry) => entry.id === id);

    setPendingId(id);
    setSaveError(null);
    setNotice(null);

    const result = await accounts.setRole(id, role);
    if (!result.ok) {
      setSaveError(result.error);
    } else if (role === 'admin') {
      const name = account?.username ?? account?.displayName ?? 'The account';
      setNotice(`${name} now has administrator access and has moved to User Manager.`);
    }

    setPendingId(null);
  };

  return (
    <AccountManager
      title="Barber Manager"
      lede="Everyone who can sign in to the barber dashboard. Use the role control to promote a barber to administrator; they then move to User Manager."
      accounts={barbers}
      isLoading={accounts.isLoading}
      error={accounts.error}
      onReload={() => void accounts.reload()}
      noun="barbers"
      emptyText="No barber accounts yet."
      noMatchText="No barber matches that search."
      searchPlaceholder="Search by name or email"
      errorTitle="Barber list unavailable"
      loadingLabel="Reading barbers…"
      loadingText="Reading the profiles table…"
      pendingId={pendingId}
      onChangeRole={(id, role) => void changeRole(id, role)}
      roleOptions={BARBER_ROLE_OPTIONS}
      notice={notice}
      saveError={saveError}
      avatarsAvailable={!accounts.avatarColumnMissing}
    />
  );
};

export default Barbers;
