import { addDays, shopDateKey, statusLabel } from '../booking/format';
import type { Booking, BookingStatus } from '../booking/types';
import { BOOKING_STATUSES } from '../booking/types';
import type { StaffAccount } from './useAccounts';

export interface ReportRange {
  /** YYYY-MM-DD in shop time, inclusive. */
  from: string;
  to: string;
}

export interface ReportSummary {
  bookings: number;
  completed: number;
  scheduled: number;
  cancelled: number;
  revenue: number;
  newAccounts: number;
}

export interface StatusTally {
  status: BookingStatus;
  label: string;
  count: number;
}

export interface ServiceTally {
  service: string;
  count: number;
  completed: number;
  revenue: number;
}

export interface BarberTally {
  key: string;
  name: string;
  count: number;
  completed: number;
  revenue: number;
}

export interface RangePreset {
  id: string;
  label: string;
  range: (today: string) => ReportRange;
}

export const RANGE_PRESETS: readonly RangePreset[] = [
  {
    id: '7d',
    label: 'Last 7 days',
    range: (today) => ({ from: addDays(today, -6), to: today }),
  },
  {
    id: '30d',
    label: 'Last 30 days',
    range: (today) => ({ from: addDays(today, -29), to: today }),
  },
  {
    id: 'month',
    label: 'This month',
    range: (today) => ({ from: `${today.slice(0, 7)}-01`, to: today }),
  },
  {
    id: 'last-month',
    label: 'Last month',
    range: (today) => {
      const last = addDays(`${today.slice(0, 7)}-01`, -1);
      return { from: `${last.slice(0, 7)}-01`, to: last };
    },
  },
];

export const isValidRange = (range: ReportRange): boolean =>
  Boolean(range.from && range.to && range.from <= range.to);

/** Calendar-date label for a YYYY-MM-DD key, without a timezone conversion. */
export const formatReportDate = (dateKey: string): string => {
  const date = new Date(`${dateKey}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
};

export const reportRangeLabel = (range: ReportRange): string =>
  `${formatReportDate(range.from)} – ${formatReportDate(range.to)}`;

const inRange = (dateKey: string, range: ReportRange): boolean =>
  dateKey >= range.from && dateKey <= range.to;

/** Appointments in the selected window, oldest first for the ledger. */
export const bookingsInRange = (bookings: Booking[], range: ReportRange): Booking[] =>
  bookings
    .filter((booking) => inRange(shopDateKey(booking.startsAt), range))
    .sort(
      (first, second) =>
        new Date(first.startsAt).getTime() - new Date(second.startsAt).getTime(),
    );

export const accountsInRange = (
  accounts: StaffAccount[],
  range: ReportRange,
): StaffAccount[] =>
  accounts
    .filter((account) => inRange(shopDateKey(account.createdAt), range))
    .sort(
      (first, second) =>
        new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime(),
    );

export const reportSummary = (
  bookings: Booking[],
  newAccounts: number,
): ReportSummary => {
  const completed = bookings.filter((booking) => booking.status === 'completed');
  const scheduled = bookings.filter(
    (booking) => booking.status === 'requested' || booking.status === 'confirmed',
  );
  const cancelled = bookings.filter((booking) => booking.status === 'cancelled');

  return {
    bookings: bookings.length,
    completed: completed.length,
    scheduled: scheduled.length,
    cancelled: cancelled.length,
    revenue: completed.reduce((sum, booking) => sum + booking.price, 0),
    newAccounts,
  };
};

export const statusTallies = (bookings: Booking[]): StatusTally[] =>
  BOOKING_STATUSES.map((status) => ({
    status,
    label: statusLabel(status),
    count: bookings.filter((booking) => booking.status === status).length,
  }));

export const serviceTallies = (bookings: Booking[]): ServiceTally[] => {
  const tallies = new Map<string, ServiceTally>();

  for (const booking of bookings) {
    const current = tallies.get(booking.service);
    const completed = booking.status === 'completed';

    if (current) {
      current.count += 1;
      if (completed) {
        current.completed += 1;
        current.revenue += booking.price;
      }
    } else {
      tallies.set(booking.service, {
        service: booking.service,
        count: 1,
        completed: completed ? 1 : 0,
        revenue: completed ? booking.price : 0,
      });
    }
  }

  return [...tallies.values()].sort(
    (first, second) =>
      second.count - first.count ||
      second.revenue - first.revenue ||
      first.service.localeCompare(second.service),
  );
};

export const barberTallies = (bookings: Booking[]): BarberTally[] => {
  const tallies = new Map<string, BarberTally>();

  for (const booking of bookings) {
    const key = booking.barberId ?? booking.barberName;
    const completed = booking.status === 'completed';
    const current = tallies.get(key);

    if (current) {
      current.count += 1;
      if (completed) {
        current.completed += 1;
        current.revenue += booking.price;
      }
    } else {
      tallies.set(key, {
        key,
        name: booking.barberName,
        count: 1,
        completed: completed ? 1 : 0,
        revenue: completed ? booking.price : 0,
      });
    }
  }

  return [...tallies.values()].sort(
    (first, second) =>
      second.count - first.count ||
      second.revenue - first.revenue ||
      first.name.localeCompare(second.name),
  );
};
