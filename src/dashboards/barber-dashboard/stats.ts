import { isOpenStatus, isToday } from '../booking/format';
import type { Booking } from '../booking/types';

export interface BarberSummary {
  today: number;
  todayActive: number;
  requested: number;
  upcoming: number;
  completed: number;
  cancelled: number;
  clients: number;
  revenue: number;
}

/**
 * The figures the barber's Overview reads. Everything is derived from the
 * bookings rows RLS already narrows to this chair, so an empty read is a real
 * zero rather than a placeholder.
 */
export const barberSummary = (bookings: Booking[]): BarberSummary => {
  const now = Date.now();
  const today = bookings.filter((booking) => isToday(booking.startsAt));
  const customers = new Set<string>();

  for (const booking of bookings) {
    if (booking.status !== 'cancelled') customers.add(booking.customerId);
  }

  return {
    today: today.length,
    todayActive: today.filter((booking) => booking.status !== 'cancelled').length,
    requested: bookings.filter((booking) => booking.status === 'requested').length,
    upcoming: bookings.filter(
      (booking) =>
        isOpenStatus(booking.status) &&
        new Date(booking.startsAt).getTime() >= now,
    ).length,
    completed: bookings.filter((booking) => booking.status === 'completed').length,
    cancelled: bookings.filter((booking) => booking.status === 'cancelled').length,
    clients: customers.size,
    revenue: bookings
      .filter((booking) => booking.status === 'completed')
      .reduce((sum, booking) => sum + booking.price, 0),
  };
};

/** The rows whose status or details changed most recently, newest first. */
export const recentActivity = (bookings: Booking[], limit = 6): Booking[] =>
  [...bookings]
    .sort(
      (first, second) =>
        new Date(second.updatedAt).getTime() -
        new Date(first.updatedAt).getTime(),
    )
    .slice(0, limit);
