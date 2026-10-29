import { useMemo, useState } from 'react';

import { BookingStatusSelect } from '../../booking/BookingStatus';
import {
  displayOrder,
  formatBookingWhen,
  formatMoney,
} from '../../booking/format';
import type { BookingStatus, BookingsState } from '../../booking/types';
import SectionHead from '../../shell/SectionHead';
import '../../booking/booking.css';

interface AdminBookingsProps {
  bookings: BookingsState;
}

const AdminBookings: React.FC<AdminBookingsProps> = ({ bookings }) => {
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const ordered = useMemo(() => displayOrder(bookings.bookings), [bookings.bookings]);
  const isLoading = bookings.isLoading && bookings.bookings.length === 0;

  const requested = bookings.bookings.filter(
    (booking) => booking.status === 'requested',
  );
  const confirmed = bookings.bookings.filter(
    (booking) => booking.status === 'confirmed',
  );
  const completed = bookings.bookings.filter(
    (booking) => booking.status === 'completed',
  );

  const count = (value: number): string => (isLoading ? '…' : String(value));

  const changeStatus = async (id: string, status: BookingStatus) => {
    setSaveError(null);
    setPendingId(id);
    const result = await bookings.setStatus(id, status);
    if (!result.ok) {
      setSaveError(result.error ?? 'Could not change the status. Try again.');
    }
    setPendingId(null);
  };

  return (
    <>
      <SectionHead
        title="Bookings"
        lede="Every appointment across Trim, with the customer's contact details, the barber, the service and the notes in one list."
      />

      <ul className="trim-metrics">
        <li className="trim-metric">
          <p className="trim-metric__label">Total</p>
          <p className="trim-metric__value">{count(bookings.bookings.length)}</p>
          <p className="trim-metric__delta">All appointments</p>
        </li>
        <li className="trim-metric">
          <p className="trim-metric__label">Requested</p>
          <p className="trim-metric__value">{count(requested.length)}</p>
          <p className="trim-metric__delta">Waiting on a barber</p>
        </li>
        <li className="trim-metric">
          <p className="trim-metric__label">Confirmed</p>
          <p className="trim-metric__value">{count(confirmed.length)}</p>
          <p className="trim-metric__delta">In the book</p>
        </li>
        <li className="trim-metric">
          <p className="trim-metric__label">Completed</p>
          <p className="trim-metric__value">{count(completed.length)}</p>
          <p className="trim-metric__delta">Cuts finished</p>
        </li>
      </ul>

      {saveError ? (
        <p className="trim-book__error" role="alert">
          {saveError}
        </p>
      ) : null}

      {bookings.error ? (
        <div className="trim-card">
          <h2 className="trim-card__title">Bookings unavailable</h2>
          <p className="trim-card__text">{bookings.error}</p>
          <div className="trim-book__empty-action">
            <button
              type="button"
              className="trim-account__analyze"
              onClick={() => void bookings.reload()}
            >
              Try again
            </button>
          </div>
        </div>
      ) : isLoading ? (
        <div className="trim-card">
          <p className="trim-card__text">Loading bookings…</p>
        </div>
      ) : ordered.length === 0 ? (
        <div className="trim-card">
          <h2 className="trim-card__title">No bookings yet</h2>
          <p className="trim-card__text">
            Appointments created from the customer dashboard appear here with the
            customer's contact details and notes.
          </p>
        </div>
      ) : (
        <div className="trim-table-wrap">
          <table className="trim-table">
            <caption className="trim-visually-hidden">
              Every booking with date, customer, barber, service, price and status
            </caption>
            <thead>
              <tr>
                <th scope="col">When</th>
                <th scope="col">Customer</th>
                <th scope="col">Barber</th>
                <th scope="col">Service</th>
                <th scope="col" className="trim-table__num">
                  Price
                </th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              {ordered.map((booking) => (
                <tr key={booking.id}>
                  <td data-label="When">{formatBookingWhen(booking.startsAt)}</td>
                  <td data-label="Customer">
                    <span className="trim-table__primary">{booking.customerName}</span>
                    <span className="trim-table__secondary trim-book__contact">
                      {booking.customerPhone}
                    </span>
                    {booking.customerEmail ? (
                      <span className="trim-table__secondary trim-book__contact">
                        {booking.customerEmail}
                      </span>
                    ) : null}
                  </td>
                  <td data-label="Barber">
                    <span className="trim-table__primary">{booking.barberName}</span>
                    <span className="trim-table__secondary">{booking.shop}</span>
                  </td>
                  <td data-label="Service">
                    <span className="trim-table__primary">{booking.service}</span>
                    <span className="trim-table__secondary">
                      {booking.durationMinutes} min
                    </span>
                    {booking.notes ? (
                      <span className="trim-table__secondary trim-book__notes">
                        {booking.notes}
                      </span>
                    ) : null}
                  </td>
                  <td data-label="Price" className="trim-table__num">
                    {formatMoney(booking.price)}
                  </td>
                  <td data-label="Status">
                    <BookingStatusSelect
                      booking={booking}
                      disabled={pendingId === booking.id}
                      onChange={(status) => void changeStatus(booking.id, status)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
};

export default AdminBookings;
