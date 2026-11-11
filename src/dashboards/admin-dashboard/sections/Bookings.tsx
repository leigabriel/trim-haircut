import { useMemo, useState } from 'react';

import { BookingStatusSelect } from '../../booking/BookingStatus';
import {
  displayOrder,
  formatBookingWhen,
  formatMoney,
} from '../../booking/format';
import type { Booking, BookingStatus, BookingsState } from '../../booking/types';
import SectionHead from '../../shell/SectionHead';
import AccountAvatar from '../AccountAvatar';
import type { AccountsState } from '../useAccounts';
import BookingDetailModal from './BookingDetailModal';
import '../../booking/booking.css';

interface AdminBookingsProps {
  bookings: BookingsState;
  accounts: AccountsState;
}

const AdminBookings: React.FC<AdminBookingsProps> = ({ bookings, accounts }) => {
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const ordered = useMemo(() => displayOrder(bookings.bookings), [bookings.bookings]);
  const isLoading = bookings.isLoading && bookings.bookings.length === 0;

  const avatars = useMemo(
    () =>
      new Map(
        accounts.accounts.map((account) => [account.id, account.avatarUrl]),
      ),
    [accounts.accounts],
  );

  const selected = selectedId
    ? (bookings.bookings.find((booking) => booking.id === selectedId) ?? null)
    : null;

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

  // Row clicks are a convenience. The View button and the status select stay
  // usable without the row swallowing their click.
  const openFromRow = (booking: Booking, target: EventTarget) => {
    if (!(target instanceof Element)) return;
    if (target.closest('button, a, select, input, textarea, label')) return;
    setSelectedId(booking.id);
  };

  return (
    <>
      <SectionHead
        title="Bookings"
        lede="Every appointment across Trim. Select a row for the full record, including the customer's avatar, contact details and notes."
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
            customer's avatar, contact details and notes.
          </p>
        </div>
      ) : (
        <div className="trim-table-wrap">
          <table className="trim-table trim-admin-bookings">
            <caption className="trim-visually-hidden">
              Every booking with date, customer, barber, service, price, status
              and a button to open the full record
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
                <th scope="col">Details</th>
              </tr>
            </thead>
            <tbody>
              {ordered.map((booking) => {
                const name = booking.customerName;

                return (
                  <tr
                    className={`trim-admin-row trim-book-row trim-book-row--${booking.status}`}
                    key={booking.id}
                    onClick={(event) => openFromRow(booking, event.target)}
                  >
                    <td data-label="When">{formatBookingWhen(booking.startsAt)}</td>

                    <td data-label="Customer">
                      <span className="trim-admin-account">
                        <AccountAvatar
                          src={avatars.get(booking.customerId) ?? null}
                          name={name}
                          className="trim-avatar--row"
                        />

                        <span className="trim-admin-account__text">
                          <span className="trim-table__primary">{name}</span>
                          {booking.customerPhone ? (
                            <span className="trim-table__secondary trim-book__contact">
                              {booking.customerPhone}
                            </span>
                          ) : null}
                          {booking.customerEmail ? (
                            <span className="trim-table__secondary trim-book__contact">
                              {booking.customerEmail}
                            </span>
                          ) : null}
                        </span>
                      </span>
                    </td>

                    <td data-label="Barber">
                      <span className="trim-admin-account">
                        <AccountAvatar
                          src={
                            booking.barberId
                              ? (avatars.get(booking.barberId) ?? null)
                              : null
                          }
                          name={booking.barberName}
                          className="trim-avatar--sm"
                        />

                        <span className="trim-admin-account__text">
                          <span className="trim-table__primary">
                            {booking.barberName}
                          </span>
                          <span className="trim-table__secondary">{booking.shop}</span>
                        </span>
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

                    <td data-label="Details">
                      <button
                        type="button"
                        className="trim-admin-view"
                        aria-haspopup="dialog"
                        aria-label={`View details for ${booking.customerName}'s ${booking.service} on ${formatBookingWhen(booking.startsAt)}`}
                        onClick={() => setSelectedId(booking.id)}
                      >
                        View
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <BookingDetailModal
        booking={selected}
        avatarUrl={selected ? (avatars.get(selected.customerId) ?? null) : null}
        onDismiss={() => setSelectedId(null)}
      />
    </>
  );
};

export default AdminBookings;
