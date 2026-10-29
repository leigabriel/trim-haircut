import { useMemo, useState } from 'react';

import { BookingStatusSelect } from '../../booking/BookingStatus';
import {
  displayOrder,
  formatBookingWhen,
  formatMoney,
  isToday,
  isUpcoming,
} from '../../booking/format';
import type { BookingStatus, BookingsState } from '../../booking/types';
import SectionHead from '../../shell/SectionHead';
import '../../booking/booking.css';

interface AppointmentsProps {
  bookings: BookingsState;
}

const Appointments: React.FC<AppointmentsProps> = ({ bookings }) => {
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const ordered = useMemo(() => displayOrder(bookings.bookings), [bookings.bookings]);
  const isLoading = bookings.isLoading && bookings.bookings.length === 0;

  const today = bookings.bookings.filter((booking) => isToday(booking.startsAt));
  const todayActive = today.filter((booking) => booking.status !== 'cancelled');
  const todayRequested = today.filter((booking) => booking.status === 'requested');
  const requested = bookings.bookings.filter(
    (booking) => booking.status === 'requested',
  );
  const upcoming = bookings.bookings.filter(isUpcoming);
  const confirmedUpcoming = upcoming.filter(
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
        title="Appointments"
        lede="Every booking for your chair, with the customer's contact details and notes. Confirm, complete or cancel from the status menu."
      />

      <ul className="trim-metrics">
        <li className="trim-metric">
          <p className="trim-metric__label">Today</p>
          <p className="trim-metric__value">{count(today.length)}</p>
          <p className="trim-metric__delta">
            {isLoading
              ? 'Loading appointments'
              : `${todayActive.length} active, ${todayRequested.length} requested`}
          </p>
        </li>
        <li className="trim-metric">
          <p className="trim-metric__label">Requested</p>
          <p className="trim-metric__value">{count(requested.length)}</p>
          <p className="trim-metric__delta">Waiting on your reply</p>
        </li>
        <li className="trim-metric">
          <p className="trim-metric__label">Upcoming</p>
          <p className="trim-metric__value">{count(upcoming.length)}</p>
          <p className="trim-metric__delta">
            {isLoading ? 'Confirmed chairs' : `${confirmedUpcoming.length} confirmed`}
          </p>
        </li>
        <li className="trim-metric">
          <p className="trim-metric__label">Completed</p>
          <p className="trim-metric__value">{count(completed.length)}</p>
          <p className="trim-metric__delta">Cuts in your history</p>
        </li>
      </ul>

      {saveError ? (
        <p className="trim-book__error" role="alert">
          {saveError}
        </p>
      ) : null}

      {bookings.error ? (
        <div className="trim-card">
          <h2 className="trim-card__title">Appointments unavailable</h2>
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
          <p className="trim-card__text">Loading your appointments…</p>
        </div>
      ) : ordered.length === 0 ? (
        <div className="trim-card">
          <h2 className="trim-card__title">No appointments yet</h2>
          <p className="trim-card__text">
            When a customer books your chair, the appointment appears here with
            their contact details and notes. Confirm it from the status menu.
          </p>
        </div>
      ) : (
        <div className="trim-table-wrap">
          <table className="trim-table">
            <caption className="trim-visually-hidden">
              Appointments for your chair with customer, service, price and status
            </caption>
            <thead>
              <tr>
                <th scope="col">When</th>
                <th scope="col">Customer</th>
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

export default Appointments;
