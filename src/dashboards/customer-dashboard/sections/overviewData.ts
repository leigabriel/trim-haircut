import { SHOP_TIME_ZONE, shopDateKey } from '../../booking/format';
import type { Booking } from '../../booking/types';
import type { Conversation } from '../ai/trimo';

export interface MonthlyBookingPoint {
  key: string;
  label: string;
  completed: number;
  scheduled: number;
  total: number;
  spend: number;
}

export interface WeeklyChatPoint {
  key: string;
  label: string;
  count: number;
}

const MONTH_LABEL = new Intl.DateTimeFormat('en-PH', {
  month: 'short',
  timeZone: 'UTC',
});

const WEEK_LABEL = new Intl.DateTimeFormat('en-PH', {
  month: 'short',
  day: 'numeric',
  timeZone: SHOP_TIME_ZONE,
});

const pad = (value: number): string => String(value).padStart(2, '0');

const monthKey = (year: number, month: number): string =>
  `${year}-${pad(month + 1)}`;

/**
 * Six calendar months of booking activity, oldest first.
 *
 * Months are shop-time months, not browser months: a 23:30 booking in Naujan
 * belongs to that day and month even when the customer is browsing from a
 * timezone where the clock has already rolled over. Completed and scheduled
 * are kept separate because they answer different questions ("what have I
 * done" versus "what is coming").
 */
export const monthlyBookingPoints = (
  bookings: Booking[],
  monthCount = 6,
  now = new Date(),
): MonthlyBookingPoint[] => {
  const currentKey = shopDateKey(now).slice(0, 7);
  const [year, month] = currentKey.split('-').map(Number);
  const currentTime = now.getTime();

  const points = Array.from({ length: monthCount }, (_, index) => {
    const offset = monthCount - 1 - index;
    const date = new Date(Date.UTC(year, month - 1 - offset, 1, 12));
    const key = monthKey(date.getUTCFullYear(), date.getUTCMonth());

    return {
      key,
      label: MONTH_LABEL.format(date),
      completed: 0,
      scheduled: 0,
      total: 0,
      spend: 0,
    };
  });

  const byMonth = new Map(points.map((point) => [point.key, point]));

  for (const booking of bookings) {
    const point = byMonth.get(shopDateKey(booking.startsAt).slice(0, 7));
    if (!point) continue;

    if (booking.status === 'completed') {
      point.completed += 1;
      point.spend += booking.price;
    } else if (
      (booking.status === 'requested' || booking.status === 'confirmed') &&
      new Date(booking.startsAt).getTime() >= currentTime
    ) {
      point.scheduled += 1;
    }
  }

  for (const point of points) point.total = point.completed + point.scheduled;
  return points;
};

/**
 * Conversations touched in each of the last `weekCount` seven-day windows.
 * One conversation counts once per window, so a long thread does not drown out
 * other conversations that were also active.
 */
export const weeklyChatPoints = (
  conversations: Conversation[],
  weekCount = 8,
  now = new Date(),
): WeeklyChatPoint[] => {
  const weekMs = 7 * 24 * 60 * 60 * 1000;
  const end = now.getTime();
  const points = Array.from({ length: weekCount }, (_, index) => {
    const start = end - (weekCount - index) * weekMs;
    return {
      key: new Date(start).toISOString(),
      label: WEEK_LABEL.format(new Date(start)),
      count: 0,
    };
  });

  for (const conversation of conversations) {
    const updated = new Date(conversation.updated_at).getTime();
    if (Number.isNaN(updated)) continue;

    const weeksAgo = Math.floor((end - updated) / weekMs);
    if (weeksAgo < 0 || weeksAgo >= weekCount) continue;

    points[weekCount - 1 - weeksAgo].count += 1;
  }

  return points;
};
