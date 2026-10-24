import { useState } from 'react';

import type { UserRole } from '../../../auth/roles';
import SectionHead from '../../shell/SectionHead';
import type { AccountsState } from '../useAccounts';
import AccountList from './AccountList';

interface BarbersProps {
  accounts: AccountsState;
}

/**
 * The barber subset of the same account list. Shop assignment is not modelled
 * yet, so it is stated as missing rather than shown as an empty field.
 */
const Barbers: React.FC<BarbersProps> = ({ accounts }) => {
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const barbers = accounts.accounts.filter((account) => account.role === 'barber');

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
        title="Barber Manager"
        lede="Everyone who can sign in to the barber dashboard. Promote a customer here once their chair is confirmed."
      />

      {accounts.error ? (
        <div className="trim-card trim-card--danger">
          <h2 className="trim-card__title">Barber list unavailable</h2>
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

      <div className="trim-card">
        <h2 className="trim-card__title">
          {accounts.isLoading ? 'Reading barbers…' : `${barbers.length} barbers`}
        </h2>

        {accounts.isLoading ? (
          <p className="trim-card__text">Reading the profiles table…</p>
        ) : (
          <AccountList
            accounts={barbers}
            pendingId={pendingId}
            onChangeRole={(id, role) => void changeRole(id, role)}
            emptyText="No barber accounts yet. Promote one in User Manager."
          />
        )}
      </div>

      <div className="trim-card">
        <h2 className="trim-card__title">Shop assignment</h2>
        <p className="trim-card__text">
          Trim has no shops table yet, so a barber is not tied to a location.
          Once it exists, this page gains a shop column and a transfer action.
        </p>
      </div>
    </>
  );
};

export default Barbers;
