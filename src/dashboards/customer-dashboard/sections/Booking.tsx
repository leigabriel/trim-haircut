import { useMemo, useState } from 'react';

import ConfirmModal from '../../../components/layout/modals/ConfirmModal';
import BookingModal from '../../booking/BookingModal';
import { BookingStatusPill } from '../../booking/BookingStatus';
import {
  displayOrder,
  formatBookingWhen,
  formatMoney,
  isUpcoming,
} from '../../booking/format';
import type { Booking, BookingsState } from '../../booking/types';
import SectionHead from '../../shell/SectionHead';
import '../../booking/booking.css';

interface BookingProps {
  bookings: BookingsState;
}

const Booking: React.FC<BookingProps> = ({ bookings }) => {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<Booking | null>(null);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const ordered = useMemo(() => displayOrder(bookings.bookings), [bookings.bookings]);
  const isLoading = bookings.isLoading && bookings.bookings.length === 0;

  const upcoming = bookings.bookings.filter(isUpcoming);
  const requested = upcoming.filter((booking) => booking.status === 'requested').length;
  const completed = bookings.bookings.filter(
    (booking) => booking.status === 'completed',
  );
  const spend = completed.reduce((total, booking) => total + booking.price, 0);

  const usual = useMemo(() => {
    const counts = new Map<string, number>();
    for (const booking of bookings.bookings) {
      if (booking.status === 'cancelled') continue;
      counts.set(booking.barberName, (counts.get(booking.barberName) ?? 0) + 1);
    }
    return (
      [...counts.entries()].sort(
        (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
      )[0] ?? null
    );
  }, [bookings.bookings]);

  const count = (value: number): string => (isLoading ? '…' : String(value));

  const openForm = () => {
    setNotice(null);
    setIsFormOpen(true);
  };

  const handleCreated = (booking: Booking) => {
    setIsFormOpen(false);
    setNotice(
      `Requested ${formatBookingWhen(booking.startsAt)} with ${booking.barberName}. The barber confirms it from their dashboard.`,
    );
    void bookings.reload();
  };

  const dismissCancel = () => {
    setCancelTarget(null);
    setCancelError(null);
  };

  const confirmCancel = async () => {
    if (!cancelTarget) return;
    const result = await bookings.setStatus(cancelTarget.id, 'cancelled');
    if (!result.ok) {
      setCancelError(result.error ?? 'Could not cancel the appointment. Try again.');
      return;
    }
    dismissCancel();
    setNotice('Appointment cancelled. The slot is open again.');
  };

  return (
    <>
      <SectionHead
        title="Booking"
        lede="Request a chair with a Trim barber. Your barber confirms from their dashboard, and every confirmed cut keeps your recommendation history in order."
      />

      <div className="trim-book__toolbar">
        <p className="trim-book__toolbar-text">
          Pick a service, a barber and a time. Same-day requests are welcome when
          the chair is open.
        </p>
        <button type="button" className="trim-book__new" onClick={openForm}>
          Book an appointment
        </button>
      </div>

      {notice ? (
        <p className="trim-book__notice" role="status">
          {notice}
        </p>
      ) : null}

      <ul className="trim-metrics">
        <li className="trim-metric">
          <p className="trim-metric__label">Upcoming</p>
          <p className="trim-metric__value">{count(upcoming.length)}</p>
          <p className="trim-metric__delta">
            {isLoading
              ? 'Loading appointments'
              : `${requested} waiting on the barber`}
          </p>
        </li>
        <li className="trim-metric">
          <p className="trim-metric__label">Completed</p>
          <p className="trim-metric__value">{count(completed.length)}</p>
          <p className="trim-metric__delta">In your history</p>
        </li>
        <li className="trim-metric">
          <p className="trim-metric__label">Spend</p>
          <p className="trim-metric__value">
            {isLoading ? '…' : formatMoney(spend)}
          </p>
          <p className="trim-metric__delta">
            Across {count(completed.length)} completed{' '}
            {completed.length === 1 ? 'cut' : 'cuts'}
          </p>
        </li>
        <li className="trim-metric">
          <p className="trim-metric__label">Usual barber</p>
          <p className="trim-metric__value trim-metric__value--text">
            {isLoading ? '…' : (usual?.[0] ?? '—')}
          </p>
          <p className="trim-metric__delta">
            {isLoading
              ? 'Loading appointments'
              : usual
                ? `${usual[1]} booking${usual[1] === 1 ? '' : 's'}`
                : 'No history yet'}
          </p>
        </li>
      </ul>

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
            Book a cut with a Trim barber. Your requests show here, and the barber
            confirms them from their dashboard.
          </p>
          <div className="trim-book__empty-action">
            <button
              type="button"
              className="trim-account__analyze"
              onClick={openForm}
            >
              Book your first appointment
            </button>
          </div>
        </div>
      ) : (
        <div className="trim-table-wrap">
          <table className="trim-table">
            <caption className="trim-visually-hidden">
              Your appointments by date, barber, service, status and price
            </caption>
            <thead>
              <tr>
                <th scope="col">When</th>
                <th scope="col">Barber</th>
                <th scope="col">Service</th>
                <th scope="col">Status</th>
                <th scope="col" className="trim-table__num">
                  Price
                </th>
                <th scope="col">
                  <span className="trim-visually-hidden">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {ordered.map((booking) => (
                <tr key={booking.id}>
                  <td data-label="When">{formatBookingWhen(booking.startsAt)}</td>
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
                  <td data-label="Status">
                    <BookingStatusPill status={booking.status} />
                  </td>
                  <td data-label="Price" className="trim-table__num">
                    {formatMoney(booking.price)}
                  </td>
                  <td data-label="Actions" className="trim-book__table-actions">
                    {isUpcoming(booking) ? (
                      <button
                        type="button"
                        className="trim-book__cancel"
                        aria-label={`Cancel ${booking.service} with ${booking.barberName} on ${formatBookingWhen(booking.startsAt)}`}
                        onClick={() => {
                          setCancelError(null);
                          setCancelTarget(booking);
                        }}
                      >
                        Cancel
                      </button>
                    ) : (
                      <span className="trim-table__secondary">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <BookingModal
        isOpen={isFormOpen}
        onDismiss={() => setIsFormOpen(false)}
        onCreated={handleCreated}
      />

      <ConfirmModal
        isOpen={Boolean(cancelTarget)}
        title="Cancel this appointment?"
        message={
          cancelTarget
            ? `${formatBookingWhen(cancelTarget.startsAt)} with ${cancelTarget.barberName} for ${cancelTarget.service}. Cancelling frees the slot for another customer.`
            : ''
        }
        confirmLabel="Cancel appointment"
        cancelLabel="Keep it"
        pendingLabel="Cancelling…"
        error={cancelError}
        onConfirm={confirmCancel}
        onDismiss={dismissCancel}
      />
    </>
  );
};

export default Booking;
