import { useCallback, useEffect, useMemo, useState } from 'react';

import { useAuth } from '../../auth/AuthProvider';

export type NotificationKind = 'booking' | 'face' | 'chat' | 'account';

export interface AppNotification<TView extends string = string> {
  /** Stable while the underlying record does not change. Used for read state. */
  id: string;
  title: string;
  body: string;
  /** When the thing happened. The panel turns this into "2 hr ago". */
  at: string;
  view: TView;
  kind: NotificationKind;
}

export interface NotificationItem<TView extends string = string>
  extends AppNotification<TView> {
  isUnread: boolean;
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

export interface ReadNotificationsState<TView extends string> {
  items: NotificationItem<TView>[];
  unreadCount: number;
  markRead: (id: string) => void;
  markAllRead: () => void;
}

/**
 * Read state for a derived notification feed.
 *
 * Neither the customer nor the admin surface stores notifications in a table,
 * so there is no read column to write. Local storage per user id is enough for
 * this device: it drives the bell badge and the unread marker, and a new device
 * starts with the feed unread.
 */
export const useReadNotifications = <TView extends string>(
  baseItems: AppNotification<TView>[],
): ReadNotificationsState<TView> => {
  const { session } = useAuth();
  const userId = session?.user.id ?? null;
  const [readIds, setReadIds] = useState<Set<string>>(() =>
    userId ? readStored(userId) : new Set(),
  );

  useEffect(() => {
    setReadIds(userId ? readStored(userId) : new Set());
  }, [userId]);

  const items = useMemo<NotificationItem<TView>[]>(
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
    markRead,
    markAllRead,
  };
};
