import { isOpenStatus, shopDateKey, statusLabel } from './format';
import type { Booking, BookingStatus } from './types';
import { BOOKING_STATUSES } from './types';

export interface MonthPoint {
  /** YYYY-MM in shop time. */
  key: string;
  label: string;
}

export interface BookingPoint extends MonthPoint {
  total: number;
  requested: number;
  confirmed: number;
  completed: number;
  cancelled: number;
}

export interface StatusCount {
  status: BookingStatus;
  label: string;
  count: number;
}

/**
 * The last `count` calendar months, oldest first, keyed in shop time. The
 * charts and the overview summaries agree on this window, so a bar labelled
 * "Aug" means August at the shop rather than in the viewer's zone.
 */
export const monthWindow = (count: number): MonthPoint[] => {
  const [year, month] = shopDateKey(new Date()).split('-').map(Number);
  const points: MonthPoint[] = [];

  for (let offset = count - 1; offset >= 0; offset -= 1) {
    const date = new Date(Date.UTC(year, month - 1 - offset, 1));
    points.push({
      key: date.toISOString().slice(0, 7),
      label: date.toLocaleDateString('en-PH', { month: 'short', timeZone: 'UTC' }),
    });
  }

  return points;
};

/** Appointments per month, bucketed by the date the cut is booked for. */
export const monthlyBookings = (
  bookings: Booking[],
  count = 6,
): BookingPoint[] => {
  const points = monthWindow(count).map<BookingPoint>((point) => ({
    ...point,
    total: 0,
    requested: 0,
    confirmed: 0,
    completed: 0,
    cancelled: 0,
  }));
  const byKey = new Map(points.map((point) => [point.key, point]));

  for (const booking of bookings) {
    const key = shopDateKey(booking.startsAt).slice(0, 7);
    const point = byKey.get(key);
    if (!point) continue;

    point.total += 1;
    point[booking.status] += 1;
  }

  return points;
};

export const statusCounts = (bookings: Booking[]): StatusCount[] =>
  BOOKING_STATUSES.map((status) => ({
    status,
    label: statusLabel(status),
    count: bookings.filter((booking) => booking.status === status).length,
  }));

/** The next open appointments, soonest first. */
export const upcomingBookings = (
  bookings: Booking[],
  limit = 5,
): Booking[] => {
  const now = Date.now();

  return bookings
    .filter(
      (booking) =>
        isOpenStatus(booking.status) &&
        new Date(booking.startsAt).getTime() >= now,
    )
    .sort(
      (first, second) =>
        new Date(first.startsAt).getTime() - new Date(second.startsAt).getTime(),
    )
    .slice(0, limit);
};
