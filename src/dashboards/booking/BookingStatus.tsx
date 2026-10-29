import { BOOKING_STATUSES, type Booking, type BookingStatus } from './types';
import { formatBookingWhen, statusLabel } from './format';

interface BookingStatusPillProps {
  status: BookingStatus;
}

/** Read-only status used on the customer list and the barber's Today page. */
export const BookingStatusPill: React.FC<BookingStatusPillProps> = ({ status }) => (
  <span className={`trim-status trim-status--${status}`}>{statusLabel(status)}</span>
);

interface BookingStatusSelectProps {
  booking: Booking;
  disabled: boolean;
  onChange: (status: BookingStatus) => void;
}

/** The barber's and admin's status control. Native select, like the role one. */
export const BookingStatusSelect: React.FC<BookingStatusSelectProps> = ({
  booking,
  disabled,
  onChange,
}) => (
  <select
    className="trim-role-select trim-book__status-select"
    value={booking.status}
    disabled={disabled}
    aria-label={`Status for ${booking.customerName}'s ${booking.service} on ${formatBookingWhen(booking.startsAt)}`}
    onChange={(event) => onChange(event.target.value as BookingStatus)}
  >
    {BOOKING_STATUSES.map((status) => (
      <option key={status} value={status}>
        {statusLabel(status)}
      </option>
    ))}
  </select>
);
