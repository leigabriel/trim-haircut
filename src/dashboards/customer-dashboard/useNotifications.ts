import { useMemo } from 'react';

import { useReadNotifications } from '../shell/notifications';
import type {
  AppNotification,
  ReadNotificationsState,
} from '../shell/notifications';
import type { BookingsState } from '../booking/types';
import type { Conversation } from './ai/trimo';
import type { DashboardView } from './data';
import type { FaceProfileState } from './face/useFaceProfile';
import { buildNotifications } from './notifications';

interface NotificationSources {
  bookings: BookingsState;
  face: FaceProfileState;
  conversations: Conversation[];
  conversationsLoading: boolean;
}

export type NotificationsState = ReadNotificationsState<DashboardView> & {
  isLoading: boolean;
  hasError: boolean;
};

/**
 * Read state for the derived notification feed.
 *
 * The notifications themselves come from bookings, face readings and Trimo
 * conversations, so there is no table to store a read column on. The shared
 * hook keeps the per-account local storage in one place for both dashboards.
 */
export const useNotifications = ({
  bookings,
  face,
  conversations,
  conversationsLoading,
}: NotificationSources): NotificationsState => {
  const isLoading = bookings.isLoading || face.isLoading || conversationsLoading;
  const hasError = Boolean(bookings.error || face.error);

  const baseItems = useMemo<AppNotification<DashboardView>[]>(
    () =>
      buildNotifications({
        bookings: bookings.bookings,
        bookingsLoading: bookings.isLoading,
        bookingsError: bookings.error,
        face: face.profile,
        faceLoading: face.isLoading,
        faceError: face.error,
        conversations,
        conversationsLoading,
      }),
    [
      bookings.bookings,
      bookings.isLoading,
      bookings.error,
      face.profile,
      face.isLoading,
      face.error,
      conversations,
      conversationsLoading,
    ],
  );

  const read = useReadNotifications(baseItems);

  return { ...read, isLoading, hasError };
};
