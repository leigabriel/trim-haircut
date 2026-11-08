import { useMemo } from 'react';

import {
  useReadNotifications,
  type AppNotification,
  type ReadNotificationsState,
} from '../shell/notifications';
import type { BookingsState } from '../booking/types';
import type { BarberView } from './data';
import { buildBarberNotifications } from './notifications';

interface BarberNotificationSources {
  bookings: BookingsState;
}

export type BarberNotificationsState = ReadNotificationsState<BarberView> & {
  isLoading: boolean;
  hasError: boolean;
};

/**
 * Read state for the barber feed. The feed itself is derived from the
 * bookings the dashboard already reads, so switching sections does not add
 * another query.
 */
export const useBarberNotifications = ({
  bookings,
}: BarberNotificationSources): BarberNotificationsState => {
  const isLoading = bookings.isLoading;
  const hasError = Boolean(bookings.error);

  const baseItems = useMemo<AppNotification<BarberView>[]>(
    () =>
      buildBarberNotifications({
        bookings: bookings.bookings,
        bookingsLoading: bookings.isLoading,
        bookingsError: bookings.error,
      }),
    [bookings.bookings, bookings.isLoading, bookings.error],
  );

  const read = useReadNotifications(baseItems);

  return { ...read, isLoading, hasError };
};
