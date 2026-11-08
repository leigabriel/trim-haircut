import { isOpenStatus, shopDateKey } from '../booking/format';
import { monthWindow } from '../booking/stats';
import type { MonthPoint } from '../booking/stats';
import type { Booking } from '../booking/types';
import type { StaffAccount } from './useAccounts';

export type {
  BookingPoint,
  MonthPoint,
  StatusCount,
} from '../booking/stats';
export {
  monthlyBookings,
  statusCounts,
  upcomingBookings,
} from '../booking/stats';

export interface SignupPoint extends MonthPoint {
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
