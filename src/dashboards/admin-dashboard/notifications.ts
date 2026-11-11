import { formatBookingWhen, shopDateKey } from '../booking/format';
import type { Booking } from '../booking/types';
import type { BookingEvent } from '../booking/useBookingEvents';
import type { AppNotification } from '../shell/notifications';
import type { AdminView } from './data';
import type { StaffAccount } from './useAccounts';

export interface BuildAdminNotificationsInput {
  bookings: Booking[];
  bookingsLoading: boolean;
  bookingsError: string | null;
  accounts: StaffAccount[];
  accountsLoading: boolean;
  accountsError: string | null;
  bookingEvents?: BookingEvent[];
  bookingEventsLoading?: boolean;
  bookingEventsError?: string | null;
}

const MAX_NOTIFICATIONS = 12;
const REMINDER_WINDOW_HOURS = 48;
const RECENT_EVENT_DAYS = 7;
const NEW_ACCOUNT_DAYS = 14;

const byNewest = (
  a: AppNotification<AdminView>,
  b: AppNotification<AdminView>,
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
 * Builds the admin notification list from the two live reads the dashboard
 * already owns: every booking and every account.
 *
 * There is no notifications table, so nothing here invents an event. Each row
 * points at a real record and opens the section that owns it. Read state is
 * kept per account by useAdminNotifications.
 */
export const buildAdminNotifications = ({
  bookings,
  bookingsLoading,
  bookingsError,
  accounts,
  accountsLoading,
  accountsError,
  bookingEvents = [],
  bookingEventsLoading = false,
  bookingEventsError = null,
}: BuildAdminNotificationsInput): AppNotification<AdminView>[] => {
  // Wait for sources. An empty feed while a query is still running would
  // read as "nothing has happened" rather than "we have not looked yet".
  if (bookingsLoading || accountsLoading || bookingEventsLoading) return [];

  const items: AppNotification<AdminView>[] = [];
  const now = Date.now();

  if (!bookingEventsError) {
    for (const event of bookingEvents) {
      if (!isWithinDays(event.createdAt, now, RECENT_EVENT_DAYS)) continue;
      if (event.eventType === 'updated') {
        items.push({
          id: `admin-booking-updated:${event.id}`,
          title: 'Booking updated',
          body: `${event.customerName} updated ${event.serviceName} — ${formatBookingWhen(event.startsAt)}.`,
          at: event.createdAt,
          view: 'bookings',
          kind: 'booking',
        });
      } else if (event.eventType === 'deleted') {
        items.push({
          id: `admin-booking-deleted:${event.id}`,
          title: 'Booking deleted',
          body: `${event.customerName} deleted ${event.serviceName} — ${formatBookingWhen(event.startsAt)}.`,
          at: event.createdAt,
          view: 'bookings',
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
          id: `admin-booking-requested:${booking.id}`,
          title: 'New booking request',
          body: `${booking.customerName} requested ${booking.service} with ${booking.barberName} — ${formatBookingWhen(
            booking.startsAt,
          )}.`,
          at: booking.updatedAt,
          view: 'bookings',
          kind: 'booking',
        });
      } else if (
        booking.status === 'cancelled' &&
        isWithinDays(booking.updatedAt, now, RECENT_EVENT_DAYS)
      ) {
        items.push({
          id: `admin-booking-cancelled:${booking.id}:${booking.updatedAt}`,
          title: 'Booking cancelled',
          body: `${booking.customerName} cancelled ${booking.service} with ${booking.barberName} — ${formatBookingWhen(
            booking.startsAt,
          )}.`,
          at: booking.updatedAt,
          view: 'bookings',
          kind: 'booking',
        });
      } else if (
        booking.status === 'completed' &&
        isWithinDays(booking.updatedAt, now, RECENT_EVENT_DAYS)
      ) {
        items.push({
          id: `admin-booking-completed:${booking.id}:${booking.updatedAt}`,
          title: 'Cut completed',
          body: `${booking.service} for ${booking.customerName} with ${booking.barberName} is marked complete.`,
          at: booking.updatedAt,
          view: 'bookings',
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
          id: `admin-booking-reminder:${booking.id}:${shopDateKey(booking.startsAt)}`,
          title: 'Appointment coming up',
          body: `${booking.customerName} · ${booking.service} with ${booking.barberName} — ${formatBookingWhen(
            booking.startsAt,
          )}.`,
          at: new Date(now).toISOString(),
          view: 'bookings',
          kind: 'booking',
        });
      }
    }
  }

  if (!accountsError) {
    for (const account of accounts) {
      if (!isWithinDays(account.createdAt, now, NEW_ACCOUNT_DAYS)) continue;

      const name = account.username ?? account.displayName ?? 'A new account';
      const kind =
        account.role === 'barber'
          ? 'New barber account'
          : account.role === 'admin'
            ? 'New administrator'
            : 'New customer joined';

      items.push({
        id: `admin-account:${account.id}`,
        title: kind,
        body:
          account.role === 'barber'
            ? `${name} can now run a chair on the barber dashboard.`
            : `${name} created a Trim account.`,
        at: account.createdAt,
        view: account.role === 'barber' ? 'barbers' : 'users',
        kind: 'account',
      });
    }
  }

  return items.sort(byNewest).slice(0, MAX_NOTIFICATIONS);
};
