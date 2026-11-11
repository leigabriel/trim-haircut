import { formatBookingWhen, shopDateKey } from '../booking/format';
import type { Booking } from '../booking/types';
import type { BookingEvent } from '../booking/useBookingEvents';
import type { AppNotification } from '../shell/notifications';
import type { BarberView } from './data';

export interface BuildBarberNotificationsInput {
  bookings: Booking[];
  bookingsLoading: boolean;
  bookingsError: string | null;
  bookingEvents?: BookingEvent[];
  bookingEventsLoading?: boolean;
  bookingEventsError?: string | null;
}

const MAX_NOTIFICATIONS = 12;
const REMINDER_WINDOW_HOURS = 48;
const RECENT_EVENT_DAYS = 7;

const byNewest = (
  a: AppNotification<BarberView>,
  b: AppNotification<BarberView>,
): number => {
  const first = new Date(a.at).getTime();
  const second = new Date(b.at).getTime();
  const safeFirst = Number.isNaN(first) ? 0 : first;
  const safeSecond = Number.isNaN(second) ? 0 : second;
  return safeSecond - safeFirst;
};

const isWithinDays = (iso: string, now: number, days: number): boolean => {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return false;
  return now - then <= days * 24 * 60 * 60 * 1000;
};

/**
 * Builds the barber notification list from the bookings rows RLS already
 * narrows to this chair.
 *
 * There is no notifications table, so nothing here invents an event. Each row
 * points at a real booking and opens the Appointments section that owns it.
 * Read state is kept per account by useBarberNotifications.
 */
export const buildBarberNotifications = ({
  bookings,
  bookingsLoading,
  bookingsError,
  bookingEvents = [],
  bookingEventsLoading = false,
  bookingEventsError = null,
}: BuildBarberNotificationsInput): AppNotification<BarberView>[] => {
  // Wait for the source. An empty feed while a query is still running would
  // read as "nothing has happened" rather than "we have not looked yet".
  if (bookingsLoading || bookingEventsLoading) return [];

  const items: AppNotification<BarberView>[] = [];
  const now = Date.now();

  if (!bookingEventsError) {
    for (const event of bookingEvents) {
      if (!isWithinDays(event.createdAt, now, RECENT_EVENT_DAYS)) continue;
      if (event.eventType === 'updated') {
        items.push({
          id: `barber-booking-updated:${event.id}`,
          title: 'Booking updated',
          body: `${event.customerName} updated ${event.serviceName} — ${formatBookingWhen(event.startsAt)}.`,
          at: event.createdAt,
          view: 'appointments',
          kind: 'booking',
        });
      } else if (event.eventType === 'deleted') {
        items.push({
          id: `barber-booking-deleted:${event.id}`,
          title: 'Booking deleted',
          body: `${event.customerName} deleted ${event.serviceName} — ${formatBookingWhen(event.startsAt)}.`,
          at: event.createdAt,
          view: 'appointments',
          kind: 'booking',
        });
      }
    }
  }

  if (!bookingsError) {
    for (const booking of bookings) {
      const start = new Date(booking.startsAt).getTime();
      const isFuture = start > now;

      if (booking.status === 'requested' && isFuture) {
        items.push({
          id: `barber-booking-requested:${booking.id}`,
          title: 'New booking request',
          body: `${booking.customerName} requested ${booking.service} — ${formatBookingWhen(
            booking.startsAt,
          )}. Waiting for you to confirm.`,
          at: booking.updatedAt,
          view: 'appointments',
          kind: 'booking',
        });
      } else if (
        booking.status === 'cancelled' &&
        isWithinDays(booking.updatedAt, now, RECENT_EVENT_DAYS)
      ) {
        items.push({
          id: `barber-booking-cancelled:${booking.id}:${booking.updatedAt}`,
          title: 'Booking cancelled',
          body: `${booking.customerName} cancelled ${booking.service} — ${formatBookingWhen(
            booking.startsAt,
          )}.`,
          at: booking.updatedAt,
          view: 'appointments',
          kind: 'booking',
        });
      } else if (
        booking.status === 'completed' &&
        isWithinDays(booking.updatedAt, now, RECENT_EVENT_DAYS)
      ) {
        items.push({
          id: `barber-booking-completed:${booking.id}:${booking.updatedAt}`,
          title: 'Cut completed',
          body: `${booking.service} for ${booking.customerName} is marked complete.`,
          at: booking.updatedAt,
          view: 'appointments',
          kind: 'booking',
        });
      }

      const hoursUntil = (start - now) / 3_600_000;
      if (
        isFuture &&
        booking.status === 'confirmed' &&
        hoursUntil > 0 &&
        hoursUntil <= REMINDER_WINDOW_HOURS
      ) {
        items.push({
          id: `barber-booking-reminder:${booking.id}:${shopDateKey(booking.startsAt)}`,
          title: 'Appointment coming up',
          body: `${booking.customerName} · ${booking.service} — ${formatBookingWhen(
            booking.startsAt,
          )}.`,
          at: new Date(now).toISOString(),
          view: 'appointments',
          kind: 'booking',
        });
      }
    }
  }

  return items.sort(byNewest).slice(0, MAX_NOTIFICATIONS);
};
