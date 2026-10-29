import type { Booking, BookingStatus } from './types';

/**
 * The shop site. Booking times are wall-clock times in Naujan, not the
 * browser's zone: a customer abroad still expects "10:00" to mean 10:00 at
 * the shop. The Philippines has no daylight saving, so a fixed +08:00 is
 * exact and avoids pulling a timezone library in.
 */
export const SHOP_TIME_ZONE = 'Asia/Manila';
export const SHOP_UTC_OFFSET = '+08:00';
export const OPEN_MINUTES = 8 * 60;
export const CLOSE_MINUTES = 17 * 60;
export const SLOT_MINUTES = 30;
export const BOOKING_WINDOW_DAYS = 90;

const DATE_KEY = new Intl.DateTimeFormat('en-CA', {
  timeZone: SHOP_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const pad = (value: number): string => String(value).padStart(2, '0');

/** YYYY-MM-DD in shop time. */
export const shopDateKey = (value: Date | string): string =>
  DATE_KEY.format(typeof value === 'string' ? new Date(value) : value);

export const shopToday = (): string => shopDateKey(new Date());

/** Adds calendar days to a YYYY-MM-DD key without involving the local zone. */
export const addDays = (dateKey: string, days: number): string => {
  const date = new Date(`${dateKey}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

/** 0 = Sunday, 6 = Saturday. The key is a calendar date, so noon UTC is safe. */
export const dayOfWeek = (dateKey: string): number =>
  new Date(`${dateKey}T12:00:00Z`).getUTCDay();

export const isShopClosed = (dateKey: string): boolean => dayOfWeek(dateKey) === 0;

export const maxBookingDate = (): string => addDays(shopToday(), BOOKING_WINDOW_DAYS - 1);

/** 08:00 onwards, in half-hour starts, that fit the service before 17:00. */
export const slotOptions = (dateKey: string, durationMinutes: number): string[] => {
  if (!dateKey || isShopClosed(dateKey)) return [];

  const slots: string[] = [];
  for (
    let minute = OPEN_MINUTES;
    minute + durationMinutes <= CLOSE_MINUTES;
    minute += SLOT_MINUTES
  ) {
    slots.push(`${pad(Math.floor(minute / 60))}:${pad(minute % 60)}`);
  }
  return slots;
};

/** "14:30" -> "2:30 PM". A wall-clock label, never a timezone conversion. */
export const slotLabel = (time: string): string => {
  const [hourValue, minuteValue] = time.split(':').map(Number);
  const suffix = hourValue >= 12 ? 'PM' : 'AM';
  const hour = hourValue % 12 || 12;
  return `${hour}:${pad(minuteValue)} ${suffix}`;
};

export const toShopIso = (dateKey: string, time: string): string =>
  `${dateKey}T${time}:00${SHOP_UTC_OFFSET}`;

export const isSlotPast = (dateKey: string, time: string): boolean =>
  new Date(toShopIso(dateKey, time)).getTime() <= Date.now();

/**
 * A sensible first date: today if there is still a start that fits, otherwise
 * the next open day. Used when the modal opens and when a longer service is
 * picked while today's remaining slots are too short.
 */
export const defaultBookingDate = (durationMinutes = SLOT_MINUTES): string => {
  let key = shopToday();
  for (let index = 0; index < 8; index += 1) {
    if (!isShopClosed(key)) {
      const slots = slotOptions(key, durationMinutes);
      if (index > 0 || slots.some((slot) => !isSlotPast(key, slot))) return key;
    }
    key = addDays(key, 1);
  }
  return shopToday();
};

export const formatMoney = (value: number): string =>
  `P ${value.toLocaleString('en-PH', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;

export const formatBookingDate = (iso: string): string =>
  new Intl.DateTimeFormat('en-PH', {
    timeZone: SHOP_TIME_ZONE,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(new Date(iso));

export const formatBookingTime = (iso: string): string =>
  new Intl.DateTimeFormat('en-PH', {
    timeZone: SHOP_TIME_ZONE,
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(iso));

export const formatBookingWhen = (iso: string): string =>
  `${formatBookingDate(iso)}, ${formatBookingTime(iso)}`;

export const statusLabel = (status: BookingStatus): string =>
  status.charAt(0).toUpperCase() + status.slice(1);

export const isOpenStatus = (status: BookingStatus): boolean =>
  status === 'requested' || status === 'confirmed';

export const isUpcoming = (booking: Booking): boolean =>
  isOpenStatus(booking.status) &&
  new Date(booking.startsAt).getTime() >= Date.now();

export const isToday = (iso: string): boolean => shopDateKey(iso) === shopToday();

/**
 * Actionable rows first (soonest first), then the history (newest first).
 * Cancelled future bookings deliberately sit in the history block.
 */
export const displayOrder = (bookings: Booking[]): Booking[] => {
  const now = Date.now();
  const upcoming = bookings
    .filter(
      (booking) =>
        isOpenStatus(booking.status) &&
        new Date(booking.startsAt).getTime() >= now,
    )
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
  const rest = bookings
    .filter(
      (booking) =>
        !(
          isOpenStatus(booking.status) &&
          new Date(booking.startsAt).getTime() >= now
        ),
    )
    .sort((a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime());
  return [...upcoming, ...rest];
};

type DatabaseError = { code?: string; message?: string } | null;

/**
 * PostgREST surfaces our raise messages as the error message. A missing table
 * or function is a setup problem, not something the customer can fix, so it
 * gets a neutral sentence; the console still has the raw error for the owner.
 * `fallback` names the action that failed, so a read error cannot claim it was
 * saving an appointment.
 */
export const readBookingError = (
  error: DatabaseError,
  fallback = 'Something went wrong. Try again.',
): string => {
  if (!error) return fallback;

  if (
    error.code === '42P01' ||
    error.code === '42883' ||
    error.code === 'PGRST202'
  ) {
    return 'Booking is not available right now. Try again later.';
  }
  if (error.code === '42501') {
    return 'Your account does not have access to that booking.';
  }
  if (error.code === '23P01' || error.code === '23505') {
    return 'That time was just booked. Pick another slot.';
  }
  if (
    error.code === '22023' ||
    error.code === '23514' ||
    error.code === 'P0001'
  ) {
    return error.message?.trim() || 'Check the appointment details and try again.';
  }
  return fallback;
};
