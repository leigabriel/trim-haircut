export type BookingStatus = 'requested' | 'confirmed' | 'completed' | 'cancelled';

export const BOOKING_STATUSES: BookingStatus[] = [
  'requested',
  'confirmed',
  'completed',
  'cancelled',
];

export const isBookingStatus = (value: string): value is BookingStatus =>
  (BOOKING_STATUSES as readonly string[]).includes(value);

/** Row shape from the bookings table. */
export interface BookingRow {
  id: string;
  customer_id: string;
  customer_name: string;
  customer_email: string | null;
  customer_phone: string;
  barber_id: string | null;
  barber_name: string;
  shop: string;
  service_id: string | null;
  service_name: string;
  price: number | string;
  duration_minutes: number;
  starts_at: string;
  notes: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

/** The camelCase shape the dashboards render. */
export interface Booking {
  id: string;
  customerId: string;
  customerName: string;
  customerEmail: string | null;
  customerPhone: string;
  barberId: string | null;
  barberName: string;
  shop: string;
  serviceId: string | null;
  service: string;
  price: number;
  durationMinutes: number;
  startsAt: string;
  notes: string | null;
  status: BookingStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ServiceOption {
  id: string;
  name: string;
  description: string | null;
  price: number;
  durationMinutes: number;
}

export interface BarberOption {
  id: string;
  username: string | null;
  displayName: string | null;
}

export interface BookingsState {
  bookings: Booking[];
  isLoading: boolean;
  error: string | null;
  reload: () => Promise<void>;
  setStatus: (
    id: string,
    status: BookingStatus,
  ) => Promise<{ ok: boolean; error?: string }>;
}

export const toBooking = (row: BookingRow): Booking => ({
  id: row.id,
  customerId: row.customer_id,
  customerName: row.customer_name,
  customerEmail: row.customer_email,
  customerPhone: row.customer_phone,
  barberId: row.barber_id,
  barberName: row.barber_name,
  shop: row.shop,
  serviceId: row.service_id,
  service: row.service_name,
  price: Number(row.price),
  durationMinutes: row.duration_minutes,
  startsAt: row.starts_at,
  notes: row.notes,
  status: isBookingStatus(row.status) ? row.status : 'requested',
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});
