import { useMemo } from 'react';

import {
  useReadNotifications,
  type AppNotification,
  type ReadNotificationsState,
} from '../shell/notifications';
import type { BookingsState } from '../booking/types';
import { useBookingEvents } from '../booking/useBookingEvents';
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
 * Read state for the admin feed. Derived from accounts, bookings, and booking
 * change events (edits/deletes by customers).
 */
export const useAdminNotifications = ({
  bookings,
  accounts,
}: AdminNotificationSources): AdminNotificationsState => {
  const bookingEvents = useBookingEvents();
  const isLoading =
    bookings.isLoading || accounts.isLoading || bookingEvents.isLoading;
  const hasError = Boolean(bookings.error || accounts.error || bookingEvents.error);

  const baseItems = useMemo<AppNotification<AdminView>[]>(
    () =>
      buildAdminNotifications({
        bookings: bookings.bookings,
        bookingsLoading: bookings.isLoading,
        bookingsError: bookings.error,
        accounts: accounts.accounts,
        accountsLoading: accounts.isLoading,
        accountsError: accounts.error,
        bookingEvents: bookingEvents.events,
        bookingEventsLoading: bookingEvents.isLoading,
        bookingEventsError: bookingEvents.error,
      }),
    [
      bookings.bookings,
      bookings.isLoading,
      bookings.error,
      accounts.accounts,
      accounts.isLoading,
      accounts.error,
      bookingEvents.events,
      bookingEvents.isLoading,
      bookingEvents.error,
    ],
  );

  const read = useReadNotifications(baseItems);

  return { ...read, isLoading, hasError };
};
