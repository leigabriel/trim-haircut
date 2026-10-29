import { useState } from 'react';

import { BookingStatusSelect } from '../../booking/BookingStatus';
import {
  addDays,
  formatBookingWhen,
  formatMoney,
  isShopClosed,
  isToday,
  isUpcoming,
  shopDateKey,
  shopToday,
} from '../../booking/format';
import type { BookingStatus, BookingsState } from '../../booking/types';
import SectionHead from '../../shell/SectionHead';
import '../../booking/booking.css';

interface TodayProps {
  bookings: BookingsState;
}

/** The barber's landing page: today's chair, then the next seven days. */
const Today: React.FC<TodayProps> = ({ bookings }) => {
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const todayKey = shopToday();
  const weekEnd = addDays(todayKey, 7);

  const isLoading = bookings.isLoading && bookings.bookings.length === 0;

  const today = bookings.bookings
    .filter((booking) => isToday(booking.startsAt))
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());

  const activeToday = today.filter((booking) => booking.status !== 'cancelled');
  const requestedToday = today.filter((booking) => booking.status === 'requested');

  const nextSeven = bookings.bookings.filter((booking) => {
    const key = shopDateKey(booking.startsAt);
    return (
      isUpcoming(booking) &&
      key > todayKey &&
      key < weekEnd &&
      !isShopClosed(key)
    );
  });

  const next = bookings.bookings
    .filter(isUpcoming)
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())[0];

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
        title="Today"
        lede="Your chair for the day: today's appointments in order, with the customer's contact details and notes. The full history lives in Appointments."
      />

      <ul className="trim-metrics">
        <li className="trim-metric">
          <p className="trim-metric__label">Today's appointments</p>
          <p className="trim-metric__value">{count(today.length)}</p>
          <p className="trim-metric__delta">
            {isLoading ? 'Loading the day' : `${activeToday.length} active`}
          </p>
        </li>
        <li className="trim-metric">
          <p className="trim-metric__label">Requested today</p>
          <p className="trim-metric__value">{count(requestedToday.length)}</p>
          <p className="trim-metric__delta">Waiting on your reply</p>
        </li>
        <li className="trim-metric">
          <p className="trim-metric__label">Next appointment</p>
          <p className="trim-metric__value trim-metric__value--text">
            {isLoading
              ? '…'
              : next
                ? formatBookingWhen(next.startsAt)
                : 'Not booked'}
          </p>
          <p className="trim-metric__delta">
            {next
              ? `${next.customerName} · ${next.service}`
              : 'The chair is open'}
          </p>
        </li>
        <li className="trim-metric">
          <p className="trim-metric__label">Next 7 days</p>
          <p className="trim-metric__value">{count(nextSeven.length)}</p>
          <p className="trim-metric__delta">Requested and confirmed</p>
        </li>
      </ul>

      {saveError ? (
        <p className="trim-book__error" role="alert">
          {saveError}
        </p>
      ) : null}

      {bookings.error ? (
        <div className="trim-card">
          <h2 className="trim-card__title">Today's chair is unavailable</h2>
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
          <p className="trim-card__text">Loading today's chair…</p>
        </div>
      ) : today.length === 0 ? (
        <div className="trim-card">
          <h2 className="trim-card__title">Nothing booked today</h2>
          <p className="trim-card__text">
            {next
              ? `Your next appointment is ${formatBookingWhen(next.startsAt)} with ${next.customerName}.`
              : 'New requests and today’s appointments appear here as soon as a customer books your chair.'}
          </p>
        </div>
      ) : (
        <div className="trim-table-wrap">
          <table className="trim-table">
            <caption className="trim-visually-hidden">
              Today's appointments by time, customer, service, price and status
            </caption>
            <thead>
              <tr>
                <th scope="col">Time</th>
                <th scope="col">Customer</th>
                <th scope="col">Service</th>
                <th scope="col" className="trim-table__num">
                  Price
                </th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              {today.map((booking) => (
                <tr key={booking.id}>
                  <td data-label="Time">{formatBookingWhen(booking.startsAt)}</td>
                  <td data-label="Customer">
                    <span className="trim-table__primary">{booking.customerName}</span>
                    <span className="trim-table__secondary trim-book__contact">
                      {booking.customerPhone}
                    </span>
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

export default Today;
