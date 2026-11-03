import { isOpenStatus, shopDateKey, statusLabel } from '../booking/format';
import type { Booking, BookingStatus } from '../booking/types';
import { BOOKING_STATUSES } from '../booking/types';
import type { StaffAccount } from './useAccounts';

export interface MonthPoint {
  /** YYYY-MM in shop time. */
  key: string;
  label: string;
}

export interface SignupPoint extends MonthPoint {
  count: number;
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

export interface BarberTally {
  key: string;
  name: string;
  count: number;
}

export interface AdminSummary {
  accounts: number;
  customers: number;
  barbers: number;
  admins: number;
  bookings: number;
  upcoming: number;
  completed: number;
  revenue: number;
}

/**
 * The last `count` calendar months, oldest first, keyed in shop time. The
 * charts and the overview summary agree on this window, so a bar labelled
 * "Aug" means August at the shop rather than in the viewer's zone.
 */
const monthWindow = (count: number): MonthPoint[] => {
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

/** New accounts per month, by profile creation date. */
export const monthlySignups = (
  accounts: StaffAccount[],
  count = 6,
): SignupPoint[] => {
  const counts = new Map<string, number>();

  for (const account of accounts) {
    const key = shopDateKey(account.createdAt).slice(0, 7);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return monthWindow(count).map((point) => ({
    ...point,
    count: counts.get(point.key) ?? 0,
  }));
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

/** The barbers carrying the most appointments, busiest first. */
export const topBarbers = (bookings: Booking[], limit = 5): BarberTally[] => {
  const tallies = new Map<string, BarberTally>();

  for (const booking of bookings) {
    // A cancelled appointment did not occupy the chair, so it should not raise
    // a barber's rank.
    if (booking.status === 'cancelled') continue;

    const key = booking.barberId ?? booking.barberName;
    const current = tallies.get(key);

    if (current) {
      current.count += 1;
    } else {
      tallies.set(key, {
        key,
        name: booking.barberName,
        count: 1,
      });
    }
  }

  return [...tallies.values()]
    .sort((first, second) => second.count - first.count || first.name.localeCompare(second.name))
    .slice(0, limit);
};

export const adminSummary = (
  accounts: StaffAccount[],
  bookings: Booking[],
): AdminSummary => {
  const now = Date.now();

  return {
    accounts: accounts.length,
    customers: accounts.filter((account) => account.role === 'customer').length,
    barbers: accounts.filter((account) => account.role === 'barber').length,
    admins: accounts.filter((account) => account.role === 'admin').length,
    bookings: bookings.length,
    upcoming: bookings.filter(
      (booking) =>
        isOpenStatus(booking.status) &&
        new Date(booking.startsAt).getTime() >= now,
    ).length,
    completed: bookings.filter((booking) => booking.status === 'completed').length,
    revenue: bookings
      .filter((booking) => booking.status === 'completed')
      .reduce((sum, booking) => sum + booking.price, 0),
  };
};

/** Newest accounts first. admin_list_accounts already sorts, but the chart
 * should not depend on that detail surviving a future query change. */
export const newestAccounts = (
  accounts: StaffAccount[],
  limit = 5,
): StaffAccount[] =>
  [...accounts]
    .sort(
      (first, second) =>
        new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime(),
    )
    .slice(0, limit);

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
