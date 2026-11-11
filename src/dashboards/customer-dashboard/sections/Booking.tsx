import { useEffect, useMemo, useState } from 'react';

import ConfirmModal from '../../../components/layout/modals/ConfirmModal';
import { supabase } from '../../../lib/supabase';
import BookingModal from '../../booking/BookingModal';
import { BookingStatusPill } from '../../booking/BookingStatus';
import {
  displayOrder,
  formatBookingWhen,
  formatMoney,
  isUpcoming,
  readBookingError,
} from '../../booking/format';
import type { BarberRating, Booking, BookingsState } from '../../booking/types';
import SectionHead from '../../shell/SectionHead';
import '../../booking/booking.css';

interface BookingProps {
  bookings: BookingsState;
}

const Booking: React.FC<BookingProps> = ({ bookings }) => {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Booking | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<Booking | null>(null);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Booking | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [ratingsByBooking, setRatingsByBooking] = useState<Record<string, BarberRating>>({});
  const [rateTarget, setRateTarget] = useState<Booking | null>(null);
  const [rateValue, setRateValue] = useState(5);
  const [rateComment, setRateComment] = useState('');
  const [rateError, setRateError] = useState<string | null>(null);
  const [isSubmittingRating, setIsSubmittingRating] = useState(false);

  const ordered = useMemo(() => displayOrder(bookings.bookings), [bookings.bookings]);
  const isLoading = bookings.isLoading && bookings.bookings.length === 0;

  const upcoming = bookings.bookings.filter(isUpcoming);
  const requested = upcoming.filter((booking) => booking.status === 'requested').length;
  const completed = bookings.bookings.filter(
    (booking) => booking.status === 'completed',
  );
  const spend = completed.reduce((total, booking) => total + booking.price, 0);

  useEffect(() => {
    let active = true;
    const ids = bookings.bookings.map((booking) => booking.id);
    if (ids.length === 0) {
      setRatingsByBooking({});
      return () => {
        active = false;
      };
    }

    void (async () => {
      const { data, error } = await supabase
        .from('barber_ratings')
        .select('id, booking_id, customer_id, barber_id, rating, comment, created_at')
        .in('booking_id', ids);

      if (!active) return;
      if (error) {
        console.error('Could not load barber ratings', error);
        return;
      }

      const map: Record<string, BarberRating> = {};
      for (const row of (data ?? []) as Array<{
        id: string;
        booking_id: string;
        customer_id: string;
        barber_id: string;
        rating: number;
        comment: string | null;
        created_at: string;
      }>) {
        map[row.booking_id] = {
          id: row.id,
          bookingId: row.booking_id,
          customerId: row.customer_id,
          barberId: row.barber_id,
          rating: Number(row.rating),
          comment: row.comment,
          createdAt: row.created_at,
        };
      }
      setRatingsByBooking(map);
    })();

    return () => {
      active = false;
    };
  }, [bookings.bookings]);

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
    setEditTarget(null);
    setIsFormOpen(true);
  };

  const openEdit = (booking: Booking) => {
    setNotice(null);
    setEditTarget(booking);
    setIsFormOpen(true);
  };

  const closeForm = () => {
    setIsFormOpen(false);
    setEditTarget(null);
  };

  const handleSaved = (booking: Booking, mode: 'created' | 'updated') => {
    closeForm();
    if (mode === 'updated') {
      setNotice(
        `Updated ${formatBookingWhen(booking.startsAt)} with ${booking.barberName} for ${booking.service}.`,
      );
    } else {
      setNotice(
        `Requested ${formatBookingWhen(booking.startsAt)} with ${booking.barberName}. The barber confirms it from their dashboard.`,
      );
    }
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

  const dismissDelete = () => {
    setDeleteTarget(null);
    setDeleteError(null);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const result = await bookings.deleteBooking(deleteTarget.id);
    if (!result.ok) {
      setDeleteError(result.error ?? 'Could not delete the appointment. Try again.');
      return;
    }
    dismissDelete();
    setNotice('Appointment deleted.');
  };

  const canRate = (booking: Booking): boolean =>
    (booking.status === 'confirmed' || booking.status === 'completed') &&
    Boolean(booking.barberId) &&
    !ratingsByBooking[booking.id];

  const openRate = (booking: Booking) => {
    setRateTarget(booking);
    setRateValue(5);
    setRateComment('');
    setRateError(null);
  };

  const dismissRate = () => {
    setRateTarget(null);
    setRateComment('');
    setRateError(null);
  };

  const submitRating = async () => {
    if (!rateTarget) return;
    setIsSubmittingRating(true);
    setRateError(null);
    try {
      const { data, error } = await supabase.rpc('submit_barber_rating', {
        p_booking_id: rateTarget.id,
        p_rating: rateValue,
        p_comment: rateComment.trim() || null,
      });
      if (error) {
        setRateError(readBookingError(error, 'Could not submit rating. Try again.'));
        return;
      }
      const row = Array.isArray(data) ? data[0] : data;
      if (row) {
        const typed = row as {
          id: string;
          booking_id: string;
          customer_id: string;
          barber_id: string;
          rating: number;
          comment: string | null;
          created_at: string;
        };
        setRatingsByBooking((current) => ({
          ...current,
          [rateTarget.id]: {
            id: typed.id,
            bookingId: typed.booking_id,
            customerId: typed.customer_id,
            barberId: typed.barber_id,
            rating: Number(typed.rating),
            comment: typed.comment,
            createdAt: typed.created_at,
          },
        }));
      }
      setNotice(`Thanks for rating ${rateTarget.barberName}.`);
      dismissRate();
    } catch (cause) {
      console.error('Could not submit barber rating', cause);
      setRateError('Could not submit rating. Check your connection and try again.');
    } finally {
      setIsSubmittingRating(false);
    }
  };

  return (
    <>
      <SectionHead
        title="Bookings"
        lede="Request a chair with a Trim barber, then edit or cancel it until the cut is done. Your barber confirms from their dashboard, and every confirmed cut keeps your recommendation history in order."
      />

      <div className="trim-book__toolbar">
        <p className="trim-book__toolbar-text">
          Pick a service, a barber and a time. Same-day requests are welcome when
          the chair is open. Upcoming appointments can be edited or cancelled;
          any appointment can be deleted.
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
              Your appointments by date, barber, service, status and price, with
              edit, cancel and delete actions
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
                <tr key={booking.id} className={`trim-book-row trim-book-row--${booking.status}`}>
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
                    <span className="trim-book__actions">
                      {canRate(booking) ? (
                        <button
                          type="button"
                          className="trim-book__edit"
                          aria-label={`Rate ${booking.barberName} for ${booking.service} on ${formatBookingWhen(booking.startsAt)}`}
                          onClick={() => openRate(booking)}
                        >
                          Rate
                        </button>
                      ) : ratingsByBooking[booking.id] ? (
                        <span className="trim-barber-picker__rating">
                          Rated ★{ratingsByBooking[booking.id].rating}
                        </span>
                      ) : null}
                      {isUpcoming(booking) ? (
                        <>
                          <button
                            type="button"
                            className="trim-book__edit"
                            aria-label={`Edit ${booking.service} with ${booking.barberName} on ${formatBookingWhen(booking.startsAt)}`}
                            onClick={() => openEdit(booking)}
                          >
                            Edit
                          </button>
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
                        </>
                      ) : null}
                      <button
                        type="button"
                        className="trim-book__delete"
                        aria-label={`Delete ${booking.service} with ${booking.barberName} on ${formatBookingWhen(booking.startsAt)}`}
                        onClick={() => {
                          setDeleteError(null);
                          setDeleteTarget(booking);
                        }}
                      >
                        Delete
                      </button>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <BookingModal
        isOpen={isFormOpen}
        booking={editTarget}
        onDismiss={closeForm}
        onSaved={handleSaved}
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

      <ConfirmModal
        isOpen={Boolean(deleteTarget)}
        title="Delete this appointment?"
        message={
          deleteTarget
            ? `${formatBookingWhen(deleteTarget.startsAt)} with ${deleteTarget.barberName} for ${deleteTarget.service}. This removes it from your booking history and cannot be undone.`
            : ''
        }
        confirmLabel="Delete appointment"
        cancelLabel="Keep it"
        pendingLabel="Deleting…"
        error={deleteError}
        onConfirm={confirmDelete}
        onDismiss={dismissDelete}
      />

      {rateTarget ? (
        <div className="trim-book-modal" role="presentation">
          <div className="trim-book-modal__scrim" aria-hidden="true" onClick={dismissRate} />
          <div
            className="trim-book-modal__card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="trim-rate-title"
          >
            <header className="trim-book-modal__head">
              <div>
                <p className="trim-book-modal__eyebrow">Feedback rating</p>
                <h2 className="trim-book-modal__title" id="trim-rate-title">
                  Rate {rateTarget.barberName}
                </h2>
                <p className="trim-book-modal__lede">
                  {rateTarget.service} · {formatBookingWhen(rateTarget.startsAt)}
                </p>
              </div>
              <button
                type="button"
                className="trim-book-modal__close"
                aria-label="Close rating form"
                disabled={isSubmittingRating}
                onClick={dismissRate}
              >
                <span aria-hidden="true">×</span>
              </button>
            </header>

            <div className="trim-book-form__grid">
              <label className="trim-book-field">
                <span className="trim-book-field__label">Rating</span>
                <select
                  value={rateValue}
                  disabled={isSubmittingRating}
                  onChange={(event) => setRateValue(Number(event.target.value))}
                >
                  {[5, 4, 3, 2, 1].map((value) => (
                    <option key={value} value={value}>
                      {value} star{value === 1 ? '' : 's'}
                    </option>
                  ))}
                </select>
              </label>

              <label className="trim-book-field trim-book-field--wide">
                <span className="trim-book-field__label">
                  Feedback <span className="trim-book-field__optional">(optional)</span>
                </span>
                <textarea
                  rows={3}
                  maxLength={500}
                  placeholder="Share your experience with this barber."
                  value={rateComment}
                  disabled={isSubmittingRating}
                  onChange={(event) => setRateComment(event.target.value)}
                />
              </label>
            </div>

            {rateError ? (
              <p className="trim-book-form__error" role="alert">
                {rateError}
              </p>
            ) : null}

            <div className="trim-book-form__actions">
              <button
                type="button"
                className="trim-book-form__cancel"
                disabled={isSubmittingRating}
                onClick={dismissRate}
              >
                Cancel
              </button>
              <button
                type="button"
                className="trim-book-form__submit"
                disabled={isSubmittingRating}
                onClick={() => void submitRating()}
              >
                {isSubmittingRating ? 'Submitting…' : 'Submit rating'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
};

export default Booking;
