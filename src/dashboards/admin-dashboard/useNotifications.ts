import { useMemo } from 'react';

import {
  useReadNotifications,
  type AppNotification,
  type ReadNotificationsState,
} from '../shell/notifications';
import type { BookingsState } from '../booking/types';
import type { AdminView } from './data';
import { buildAdminNotifications } from './notifications';
import type { AccountsState } from './useAccounts';

interface AdminNotificationSources {
  bookings: BookingsState;
  accounts: AccountsState;
}

export type AdminNotificationsState = ReadNotificationsState<AdminView> & {
  isLoading: boolean;
  hasError: boolean;
};

/**
 * Read state for the admin feed. The feed itself is derived from the accounts
 * and bookings the dashboard already reads, so switching sections does not add
 * another query.
 */
export const useAdminNotifications = ({
  bookings,
  accounts,
}: AdminNotificationSources): AdminNotificationsState => {
  const isLoading = bookings.isLoading || accounts.isLoading;
  const hasError = Boolean(bookings.error || accounts.error);

  const baseItems = useMemo<AppNotification<AdminView>[]>(
    () =>
      buildAdminNotifications({
        bookings: bookings.bookings,
        bookingsLoading: bookings.isLoading,
        bookingsError: bookings.error,
        accounts: accounts.accounts,
        accountsLoading: accounts.isLoading,
        accountsError: accounts.error,
      }),
    [
      bookings.bookings,
      bookings.isLoading,
      bookings.error,
      accounts.accounts,
      accounts.isLoading,
      accounts.error,
    ],
  );

  const read = useReadNotifications(baseItems);

  return { ...read, isLoading, hasError };
};
