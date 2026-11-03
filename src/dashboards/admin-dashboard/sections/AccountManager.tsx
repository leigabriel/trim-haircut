import { useMemo, useState } from 'react';

import type { UserRole } from '../../../auth/roles';
import SectionHead from '../../shell/SectionHead';
import type { StaffAccount } from '../useAccounts';
import AccountList from './AccountList';

interface AccountManagerProps {
  title: string;
  lede: string;
  /** The role-scoped list this page owns: users here, barbers there. */
  accounts: StaffAccount[];
  isLoading: boolean;
  error: string | null;
  onReload: () => void;
  /** Plural noun used in the count, e.g. "accounts" or "barbers". */
  noun: string;
  emptyText: string;
  noMatchText: string;
  searchPlaceholder: string;
  errorTitle: string;
  loadingLabel: string;
  loadingText: string;
  pendingId?: string | null;
  onChangeRole?: (id: string, role: UserRole) => void;
  roleOptions?: readonly UserRole[];
  notice?: string | null;
  saveError?: string | null;
  /** False when the RPC predates 0011 and cannot return avatar_url. */
  avatarsAvailable?: boolean;
}

const plural = (count: number, singular: string, noun: string): string =>
  `${count} ${count === 1 ? singular : noun}`;

/**
 * One manager page, used by both User Manager and Barber Manager.
 *
 * The table, search, count, error and notice markup live here so the two pages
 * cannot drift into near-copies. What differs is the role-scoped list they are
 * given and whether the role column is editable; that keeps every account on
 * exactly one page instead of showing the same rows twice.
 */
const AccountManager: React.FC<AccountManagerProps> = ({
  title,
  lede,
  accounts,
  isLoading,
  error,
  onReload,
  noun,
  emptyText,
  noMatchText,
  searchPlaceholder,
  errorTitle,
  loadingLabel,
  loadingText,
  pendingId = null,
  onChangeRole,
  roleOptions,
  notice = null,
  saveError = null,
  avatarsAvailable = true,
}) => {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return accounts;

    return accounts.filter((account) =>
      [
        account.username ?? '',
        account.displayName ?? '',
        account.email,
        account.role,
      ].some((field) => field.toLowerCase().includes(needle)),
    );
  }, [accounts, query]);

  const singular = noun.endsWith('s') ? noun.slice(0, -1) : noun;
  const countLabel =
    filtered.length === accounts.length
      ? plural(accounts.length, singular, noun)
      : `${plural(filtered.length, singular, noun)} of ${plural(
          accounts.length,
          singular,
          noun,
        )}`;

  const listEmptyText =
    accounts.length === 0
      ? error
        ? 'The account list could not be read. Use Try again above.'
        : emptyText
      : noMatchText;

  return (
    <>
      <SectionHead title={title} lede={lede} />

      {error ? (
        <div className="trim-card trim-card--danger">
          <h2 className="trim-card__title">{errorTitle}</h2>
          <p className="trim-card__text">{error}</p>
          <button
            className="trim-account__analyze"
            type="button"
            onClick={onReload}
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

      {notice ? (
        <p className="trim-admin__notice" role="status">
          {notice}
        </p>
      ) : null}

      {!avatarsAvailable ? (
        <p className="trim-report__note">
          Profile photos are unavailable until{' '}
          <code>supabase/migrations/0011_admin_account_avatar.sql</code> is
          applied. The tables fall back to the name initial until then.
        </p>
      ) : null}

      <label className="trim-search">
        <span className="trim-visually-hidden">Search {noun}</span>
        <input
          className="trim-search__input"
          type="search"
          placeholder={searchPlaceholder}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>

      <div className="trim-card">
        <h2 className="trim-card__title">
          {isLoading
            ? loadingLabel
            : error && accounts.length === 0
              ? 'Account list unavailable'
              : countLabel}
        </h2>

        {isLoading ? (
          <p className="trim-card__text">{loadingText}</p>
        ) : (
          <AccountList
            accounts={filtered}
            pendingId={pendingId}
            onChangeRole={onChangeRole}
            roleOptions={roleOptions}
            emptyText={listEmptyText}
          />
        )}
      </div>
    </>
  );
};

export default AccountManager;
