import { useMemo } from 'react';

import {
  useReadNotifications,
  type AppNotification,
  type ReadNotificationsState,
} from '../shell/notifications';
import type { BookingsState } from '../booking/types';
import { useBookingEvents } from '../booking/useBookingEvents';
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
 * Read state for the barber feed. Derived from bookings and booking change
 * events (edits/deletes by customers).
 */
export const useBarberNotifications = ({
  bookings,
}: BarberNotificationSources): BarberNotificationsState => {
  const bookingEvents = useBookingEvents();
  const isLoading = bookings.isLoading || bookingEvents.isLoading;
  const hasError = Boolean(bookings.error || bookingEvents.error);

  const baseItems = useMemo<AppNotification<BarberView>[]>(
    () =>
      buildBarberNotifications({
        bookings: bookings.bookings,
        bookingsLoading: bookings.isLoading,
        bookingsError: bookings.error,
        bookingEvents: bookingEvents.events,
        bookingEventsLoading: bookingEvents.isLoading,
        bookingEventsError: bookingEvents.error,
      }),
    [
      bookings.bookings,
      bookings.isLoading,
      bookings.error,
      bookingEvents.events,
      bookingEvents.isLoading,
      bookingEvents.error,
    ],
  );

  const read = useReadNotifications(baseItems);

  return { ...read, isLoading, hasError };
};
