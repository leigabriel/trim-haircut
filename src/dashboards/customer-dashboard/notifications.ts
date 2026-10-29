import { formatBookingWhen, shopDateKey } from '../booking/format';
import type { Booking } from '../booking/types';
import type { Conversation } from './ai/trimo';
import type { FaceProfile } from './face/api';
import { faceShapeLabel } from './face/shapes';
import type { DashboardView } from './data';

export type NotificationKind = 'booking' | 'face' | 'chat';

export interface AppNotification {
  /** Stable while the underlying record does not change. Used for read state. */
  id: string;
  title: string;
  body: string;
  /** When the thing happened. The panel turns this into "2 hr ago". */
  at: string;
  view: DashboardView;
  kind: NotificationKind;
}

export interface NotificationItem extends AppNotification {
  isUnread: boolean;
}

export interface BuildNotificationsInput {
  bookings: Booking[];
  bookingsLoading: boolean;
  bookingsError: string | null;
  face: FaceProfile | null;
  faceLoading: boolean;
  faceError: string | null;
  conversations: Conversation[];
  conversationsLoading: boolean;
}

const MAX_NOTIFICATIONS = 8;
const REMINDER_WINDOW_HOURS = 48;

const byNewest = (a: AppNotification, b: AppNotification): number => {
  const first = new Date(a.at).getTime();
  const second = new Date(b.at).getTime();
  const safeFirst = Number.isNaN(first) ? 0 : first;
  const safeSecond = Number.isNaN(second) ? 0 : second;
  return safeSecond - safeFirst;
};

/**
 * Builds the notification list from the records the customer can already see:
 * their bookings, their face reading and their Trimo conversations.
 *
 * There is no notifications table yet, so nothing here invents an event. Every
 * row points at a real booking/reading/conversation and opens the section that
 * owns it. Read state is kept per account by useNotifications.
 */
export const buildNotifications = ({
  bookings,
  bookingsLoading,
  bookingsError,
  face,
  faceLoading,
  faceError,
  conversations,
  conversationsLoading,
}: BuildNotificationsInput): AppNotification[] => {
  // Wait for the sources. An empty feed while a query is still running would
  // read as "nothing has happened" rather than "we have not looked yet".
  if (bookingsLoading || faceLoading || conversationsLoading) return [];

  const items: AppNotification[] = [];
  const now = Date.now();

  // A failed read is not an empty account: skip the rows that would claim
  // otherwise rather than turning a network error into "no appointments".
  if (!bookingsError) {
    for (const booking of bookings) {
      const isFuture = new Date(booking.startsAt).getTime() > now;

      if (booking.status === 'requested' && isFuture) {
        items.push({
          id: `booking-requested:${booking.id}`,
          title: 'Appointment requested',
          body: `${booking.service} with ${booking.barberName} on ${formatBookingWhen(
            booking.startsAt,
          )}. Waiting for the barber to confirm.`,
          at: booking.updatedAt,
          view: 'booking',
          kind: 'booking',
        });
      } else if (booking.status === 'confirmed' && isFuture) {
        items.push({
          id: `booking-confirmed:${booking.id}`,
          title: 'Appointment confirmed',
          body: `${booking.barberName} confirmed ${booking.service} for ${formatBookingWhen(
            booking.startsAt,
          )}.`,
          at: booking.updatedAt,
          view: 'booking',
          kind: 'booking',
        });
      } else if (booking.status === 'completed') {
        items.push({
          id: `booking-completed:${booking.id}`,
          title: 'Cut completed',
          body: `${booking.service} with ${booking.barberName} on ${formatBookingWhen(
            booking.startsAt,
          )} is in your history.`,
          at: booking.updatedAt,
          view: 'booking',
          kind: 'booking',
        });
      } else if (booking.status === 'cancelled') {
        items.push({
          id: `booking-cancelled:${booking.id}`,
          title: 'Appointment cancelled',
          body: `${booking.service} on ${formatBookingWhen(
            booking.startsAt,
          )} was cancelled.`,
          at: booking.updatedAt,
          view: 'booking',
          kind: 'booking',
        });
      }

      const hoursUntil = (new Date(booking.startsAt).getTime() - now) / 3_600_000;
      if (
        isFuture &&
        booking.status === 'confirmed' &&
        hoursUntil > 0 &&
        hoursUntil <= REMINDER_WINDOW_HOURS
      ) {
        items.push({
          id: `booking-reminder:${booking.id}:${shopDateKey(booking.startsAt)}`,
          title: 'Appointment coming up',
          body: `${booking.service} with ${booking.barberName} — ${formatBookingWhen(
            booking.startsAt,
          )}.`,
          at: new Date(now).toISOString(),
          view: 'booking',
          kind: 'booking',
        });
      }
    }
  }

  if (!faceError && face) {
    const confidence =
      face.source === 'scanned' && face.confidence !== null
        ? ` with ${face.confidence}% confidence`
        : '';

    items.push({
      id: `face:${face.measured_at}:${face.shape}`,
      title: face.source === 'scanned' ? 'Face reading updated' : 'Face shape saved',
      body: `You are set as ${faceShapeLabel(face.shape)}${confidence}. Recommendations are using it.`,
      at: face.measured_at,
      view: 'face-shape',
      kind: 'face',
    });
  }

  for (const conversation of conversations.slice(0, 3)) {
    const title = conversation.title?.trim();
    items.push({
      id: `chat:${conversation.id}:${conversation.updated_at}`,
      title: 'Trimo conversation updated',
      body: title && title.length > 0 ? title : 'Your Trimo conversation is ready to continue.',
      at: conversation.updated_at,
      view: 'ai',
      kind: 'chat',
    });
  }

  return items.sort(byNewest).slice(0, MAX_NOTIFICATIONS);
};
