import { useCallback, useEffect, useState } from 'react';

import { isUserRole } from '../../auth/roles';
import type { UserRole } from '../../auth/roles';
import { supabase } from '../../lib/supabase';

/** One row from admin_list_accounts. */
export interface StaffAccount {
  id: string;
  username: string | null;
  displayName: string | null;
  email: string;
  role: UserRole;
  createdAt: string;
}

interface AccountRow {
  id: string;
  username: string | null;
  display_name: string | null;
  email: string | null;
  role: string;
  created_at: string;
}

const toAccount = (row: AccountRow): StaffAccount => ({
  id: row.id,
  username: row.username,
  displayName: row.display_name,
  email: row.email ?? 'No email',
  role: isUserRole(row.role) ? row.role : 'customer',
  createdAt: row.created_at,
});

/**
 * Turns a Postgres or PostgREST failure into something an admin can act on.
 * The migration cases are distinguishable: 42883 is a missing function, 42501
 * is the role check refusing the call.
 */
const readError = (code: string | undefined, message: string): string => {
  if (code === '42883' || code === 'PGRST202') {
    return 'Account management is not installed yet. Apply supabase/migrations/0008_staff_roles.sql, then reload.';
  }
  if (code === '42501') return 'This account does not have admin access.';
  return message;
};

/**
 * Reads every account through admin_list_accounts.
 *
 * A plain select cannot do this: the profiles policy exposes only the caller's
 * own row. The function is security definer and re-checks the caller's role, so
 * the widening happens inside the database rather than via a broad RLS policy.
 */
export const useAccounts = () => {
  const [accounts, setAccounts] = useState<StaffAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);

    const { data, error: cause } = await supabase.rpc('admin_list_accounts');

    if (cause) {
      setAccounts([]);
      setError(readError(cause.code, cause.message));
    } else {
      setAccounts(((data ?? []) as AccountRow[]).map(toAccount));
      setError(null);
    }

    setIsLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const setRole = useCallback(async (id: string, role: UserRole) => {
    const { error: cause } = await supabase.rpc('admin_set_role', {
      p_user: id,
      p_role: role,
    });

    if (cause) return { ok: false as const, error: readError(cause.code, cause.message) };

    setAccounts((current) =>
      current.map((account) => (account.id === id ? { ...account, role } : account)),
    );
    return { ok: true as const };
  }, []);

  return { accounts, isLoading, error, reload: load, setRole };
};

export type AccountsState = ReturnType<typeof useAccounts>;
