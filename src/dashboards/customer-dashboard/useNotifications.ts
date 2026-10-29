import { useCallback, useEffect, useMemo, useState } from 'react';

import { useAuth } from '../../auth/AuthProvider';
import type { BookingsState } from '../booking/types';
import type { Conversation } from './ai/trimo';
import type { FaceProfileState } from './face/useFaceProfile';
import {
  buildNotifications,
  type NotificationItem,
} from './notifications';

interface NotificationSources {
  bookings: BookingsState;
  face: FaceProfileState;
  conversations: Conversation[];
  conversationsLoading: boolean;
}

export interface NotificationsState {
  items: NotificationItem[];
  unreadCount: number;
  isLoading: boolean;
  hasError: boolean;
  markRead: (id: string) => void;
  markAllRead: () => void;
}

const storageKey = (userId: string): string => `trim:notifications:read:${userId}`;

const readStored = (userId: string): Set<string> => {
  try {
    const raw = window.localStorage.getItem(storageKey(userId));
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return new Set();

    return new Set(parsed.filter((value): value is string => typeof value === 'string'));
  } catch {
    // Private mode or a blocked storage API. Read state simply starts empty.
    return new Set();
  }
};

const writeStored = (userId: string, ids: Set<string>): void => {
  try {
    window.localStorage.setItem(storageKey(userId), JSON.stringify([...ids]));
  } catch {
    // Not worth interrupting the dashboard over.
  }
};

/**
 * Read state for the derived notification feed.
 *
 * The notifications themselves come from bookings, face readings and Trimo
 * conversations, so there is no table to store a read column on. Local storage
 * per user id is enough for this device: it is what drives the bell badge and
 * the unread marker, and a new device starts with the feed unread.
 */
export const useNotifications = ({
  bookings,
  face,
  conversations,
  conversationsLoading,
}: NotificationSources): NotificationsState => {
  const { session } = useAuth();
  const userId = session?.user.id ?? null;
  const [readIds, setReadIds] = useState<Set<string>>(() =>
    userId ? readStored(userId) : new Set(),
  );

  useEffect(() => {
    setReadIds(userId ? readStored(userId) : new Set());
  }, [userId]);

  const isLoading =
    bookings.isLoading || face.isLoading || conversationsLoading;
  const hasError = Boolean(bookings.error || face.error);

  const baseItems = useMemo(
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

  const items = useMemo<NotificationItem[]>(
    () =>
      baseItems.map((item) => ({
        ...item,
        isUnread: !readIds.has(item.id),
      })),
    [baseItems, readIds],
  );

  const unreadCount = useMemo(
    () => items.filter((item) => item.isUnread).length,
    [items],
  );

  const markRead = useCallback(
    (id: string) => {
      if (!userId) return;

      setReadIds((current) => {
        if (current.has(id)) return current;
        const next = new Set(current);
        next.add(id);
        writeStored(userId, next);
        return next;
      });
    },
    [userId],
  );

  const markAllRead = useCallback(() => {
    if (!userId || items.length === 0) return;

    setReadIds((current) => {
      const next = new Set(current);
      for (const item of items) next.add(item.id);
      writeStored(userId, next);
      return next;
    });
  }, [items, userId]);

  return {
    items,
    unreadCount,
    isLoading,
    hasError,
    markRead,
    markAllRead,
  };
};
