import { useMemo } from 'react';

import BookingAvatar from '../../booking/BookingAvatar';
import { BookingStatusPill } from '../../booking/BookingStatus';
import {
  formatBookingWhen,
  formatMoney,
  statusLabel,
} from '../../booking/format';
import {
  monthlyBookings,
  statusCounts,
  upcomingBookings,
} from '../../booking/stats';
import type { BookingsState } from '../../booking/types';
import '../../booking/booking.css';
import '../../shell/charts.css';
import SectionHead from '../../shell/SectionHead';
import { barberSummary, recentActivity } from '../stats';

interface OverviewProps {
  bookings: BookingsState;
}

const bookingAriaLabel = (
  points: ReturnType<typeof monthlyBookings>,
): string =>
  points
    .map(
      (point) =>
        `${point.label}: ${point.completed} completed, ${
          point.requested + point.confirmed
        } scheduled, ${point.cancelled} cancelled`,
    )
    .join('. ');

const BookingActivity: React.FC<{
  bookings: BookingsState;
  points: ReturnType<typeof monthlyBookings>;
}> = ({ bookings, points }) => {
  const total = points.reduce((sum, point) => sum + point.total, 0);
  const completed = points.reduce((sum, point) => sum + point.completed, 0);
  const scheduled = points.reduce(
    (sum, point) => sum + point.requested + point.confirmed,
    0,
  );
  const cancelled = points.reduce((sum, point) => sum + point.cancelled, 0);
  const max = Math.max(1, ...points.map((point) => point.total));

  return (
    <section className="trim-card trim-barber__wide">
      <div className="trim-chart__head">
        <div>
          <h2 className="trim-card__title">Booking activity</h2>
          <p className="trim-chart__summary">
            {bookings.isLoading
              ? 'Reading your appointments…'
              : bookings.error
                ? 'Booking history is unavailable'
                : total === 0
                  ? 'No appointments in the last six months'
                  : `${completed} completed · ${scheduled} scheduled · ${cancelled} cancelled`}
          </p>
        </div>
        <span className="trim-chart__window">6 months</span>
      </div>

      {bookings.isLoading ? (
        <p className="trim-chart__empty">Loading appointment history…</p>
      ) : bookings.error ? (
        <p className="trim-chart__empty">Could not load appointment history.</p>
      ) : total === 0 ? (
        <p className="trim-chart__empty">
          The chart fills in as customers request your chair.
        </p>
      ) : (
        <div
          className="trim-chart__plot"
          role="img"
          aria-label={`Booking activity. ${bookingAriaLabel(points)}.`}
        >
          {points.map((point) => {
            const height = Math.max(0, (point.total / max) * 100);
            const completedShare =
              point.total > 0 ? (point.completed / point.total) * 100 : 0;
            const scheduledShare =
              point.total > 0
                ? ((point.requested + point.confirmed) / point.total) * 100
                : 0;
            const cancelledShare =
              point.total > 0 ? (point.cancelled / point.total) * 100 : 0;

            return (
              <div
                className="trim-chart__col"
                key={point.key}
                title={`${point.label}: ${point.total} total · ${point.completed} completed · ${
                  point.requested + point.confirmed
                } scheduled · ${point.cancelled} cancelled`}
              >
                <div className="trim-chart__track">
                  {point.total > 0 ? (
                    <span
                      className="trim-chart__value"
                      style={{ bottom: `calc(${height}% + 0.3rem)` }}
                    >
                      {point.total}
                    </span>
                  ) : null}
                  <div className="trim-chart__stack" style={{ height: `${height}%` }}>
                    {point.completed > 0 ? (
                      <span
                        className="trim-chart__bar trim-chart__bar--completed"
                        style={{ height: `${completedShare}%` }}
                      />
                    ) : null}
                    {point.requested + point.confirmed > 0 ? (
                      <span
                        className="trim-chart__bar trim-chart__bar--scheduled"
                        style={{ height: `${scheduledShare}%` }}
                      />
                    ) : null}
                    {point.cancelled > 0 ? (
                      <span
                        className="trim-chart__bar trim-chart__bar--cancelled"
                        style={{ height: `${cancelledShare}%` }}
                      />
                    ) : null}
                  </div>
                </div>
                <span className="trim-chart__label">{point.label}</span>
              </div>
            );
          })}
        </div>
      )}

      <ul className="trim-chart__legend">
        <li>
          <span className="trim-chart__key trim-chart__key--completed" aria-hidden="true" />
          Completed
        </li>
        <li>
          <span className="trim-chart__key trim-chart__key--scheduled" aria-hidden="true" />
          Scheduled
        </li>
        <li>
          <span className="trim-chart__key trim-chart__key--cancelled" aria-hidden="true" />
          Cancelled
        </li>
      </ul>
    </section>
  );
};

const StatusSplit: React.FC<{
  bookings: BookingsState;
  counts: ReturnType<typeof statusCounts>;
}> = ({ bookings, counts }) => {
  const total = counts.reduce((sum, entry) => sum + entry.count, 0);

  return (
    <section className="trim-card">
      <div className="trim-chart__head">
        <div>
          <h2 className="trim-card__title">Booking status</h2>
          <p className="trim-chart__summary">
            {bookings.isLoading
              ? 'Reading appointments…'
              : bookings.error
                ? 'Status split is unavailable'
                : total === 0
                  ? 'Nothing booked yet'
                  : `${total} ${total === 1 ? 'appointment' : 'appointments'} on your chair`}
          </p>
        </div>
      </div>

      {bookings.isLoading ? (
        <p className="trim-chart__empty">Loading the status split…</p>
      ) : bookings.error ? (
        <p className="trim-chart__empty">Could not load the status split.</p>
      ) : total === 0 ? (
        <p className="trim-chart__empty">
          Requested, confirmed, completed and cancelled counts will appear here.
        </p>
      ) : (
        <ul className="trim-barber-bars">
          {counts.map((entry) => (
            <li
              className="trim-barber-bars__item"
              key={entry.status}
              title={`${entry.label}: ${entry.count} ${
                entry.count === 1 ? 'appointment' : 'appointments'
              }`}
            >
              <div className="trim-barber-bars__head">
                <span>{entry.label}</span>
                <span className="trim-barber-bars__count">
                  {entry.count} · {Math.round((entry.count / total) * 100)}%
                </span>
              </div>
              <div className="trim-barber-bars__track">
                <span
                  className={`trim-barber-bars__fill trim-barber-bars__fill--${entry.status}`}
                  style={{ width: `${(entry.count / total) * 100}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};

const RecentActivity: React.FC<{
  bookings: BookingsState;
  rows: ReturnType<typeof recentActivity>;
}> = ({ bookings, rows }) => (
  <section className="trim-card">
    <div className="trim-chart__head">
      <div>
        <h2 className="trim-card__title">Recent activity</h2>
        <p className="trim-chart__summary">
          {bookings.isLoading
            ? 'Reading appointments…'
            : bookings.error
              ? 'Activity is unavailable'
              : rows.length === 0
                ? 'No changes yet'
                : 'The latest status changes on your chair'}
        </p>
      </div>
    </div>

    {bookings.isLoading ? (
      <p className="trim-chart__empty">Loading activity…</p>
    ) : bookings.error ? (
      <p className="trim-chart__empty">Could not load activity.</p>
    ) : rows.length === 0 ? (
      <p className="trim-chart__empty">
        Requests, confirmations and completed cuts will show here.
      </p>
    ) : (
      <ul className="trim-saved">
        {rows.map((booking) => (
          <li className="trim-saved__row" key={booking.id}>
            <BookingAvatar
              src={booking.customerAvatarUrl}
              name={booking.customerName}
              className="trim-book-avatar--row"
            />
            <span className="trim-saved__text">
              <span className="trim-saved__name">{booking.customerName}</span>
              <span className="trim-saved__meta">
                {statusLabel(booking.status)} · {booking.service} · updated{' '}
                {formatBookingWhen(booking.updatedAt)}
              </span>
            </span>
            <BookingStatusPill status={booking.status} />
          </li>
        ))}
      </ul>
    )}
  </section>
);

/**
 * Barber landing section. Every figure is counted from the bookings rows RLS
 * already narrows to this chair. The chart is CSS, not a canvas or a chart
 * library, so it inherits the dashboard type and colour system.
 */
const Overview: React.FC<OverviewProps> = ({ bookings }) => {
  const summary = useMemo(
    () => barberSummary(bookings.bookings),
    [bookings.bookings],
  );
  const points = useMemo(
    () => monthlyBookings(bookings.bookings),
    [bookings.bookings],
  );
  const statuses = useMemo(
    () => statusCounts(bookings.bookings),
    [bookings.bookings],
  );
  const upcoming = useMemo(
    () => upcomingBookings(bookings.bookings, 5),
    [bookings.bookings],
  );
  const activity = useMemo(
    () => recentActivity(bookings.bookings),
    [bookings.bookings],
  );

  const count = (value: number): string =>
    bookings.isLoading ? '…' : bookings.error ? '—' : String(value);

  const money = (value: number): string =>
    bookings.isLoading ? '…' : bookings.error ? '—' : formatMoney(value);

  const next = upcoming[0] ?? null;

  return (
    <>
      <SectionHead
        title="Overview"
        lede="Your chair at a glance: today's appointments, the requests waiting on you, completed cuts, and the activity behind the numbers."
      />

      <ul className="trim-metrics">
        <li className="trim-metric">
          <p className="trim-metric__label">Today's appointments</p>
          <p className="trim-metric__value">{count(summary.today)}</p>
          <p className="trim-metric__delta">
            {bookings.isLoading
              ? 'Loading the day'
              : `${summary.todayActive} active`}
          </p>
        </li>
        <li className="trim-metric">
          <p className="trim-metric__label">Requested</p>
          <p className="trim-metric__value">{count(summary.requested)}</p>
          <p className="trim-metric__delta">Waiting on your reply</p>
        </li>
        <li className="trim-metric">
          <p className="trim-metric__label">Upcoming</p>
          <p className="trim-metric__value">{count(summary.upcoming)}</p>
          <p className="trim-metric__delta">
            {next
              ? `Next: ${formatBookingWhen(next.startsAt)}`
              : 'The chair is open'}
          </p>
        </li>
        <li className="trim-metric">
          <p className="trim-metric__label">Completed</p>
          <p className="trim-metric__value">{count(summary.completed)}</p>
          <p className="trim-metric__delta">Cuts in your history</p>
        </li>
        <li className="trim-metric">
          <p className="trim-metric__label">Revenue</p>
          <p className="trim-metric__value">{money(summary.revenue)}</p>
          <p className="trim-metric__delta">Completed cuts only</p>
        </li>
        <li className="trim-metric">
          <p className="trim-metric__label">Clients</p>
          <p className="trim-metric__value">{count(summary.clients)}</p>
          <p className="trim-metric__delta">Customers in your book</p>
        </li>
      </ul>

      {bookings.error ? (
        <div className="trim-card trim-card--danger">
          <h2 className="trim-card__title">Overview unavailable</h2>
          <p className="trim-card__text">{bookings.error}</p>
          <button
            className="trim-account__analyze"
            type="button"
            onClick={() => void bookings.reload()}
          >
            Try again
          </button>
        </div>
      ) : null}

      <div className="trim-barber__grid">
        <BookingActivity bookings={bookings} points={points} />

        <StatusSplit bookings={bookings} counts={statuses} />
        <RecentActivity bookings={bookings} rows={activity} />

        <section className="trim-card trim-barber__wide">
          <div className="trim-chart__head">
            <div>
              <h2 className="trim-card__title">Upcoming appointments</h2>
              <p className="trim-chart__summary">
                {bookings.isLoading
                  ? 'Reading appointments…'
                  : bookings.error
                    ? 'Appointment list is unavailable'
                    : upcoming.length === 0
                      ? 'The chair is open'
                      : `${upcoming.length} of ${summary.upcoming} ${
                          summary.upcoming === 1 ? 'booking' : 'bookings'
                        }`}
              </p>
            </div>
          </div>

          {bookings.isLoading ? (
            <p className="trim-chart__empty">Loading appointments…</p>
          ) : bookings.error ? (
            <p className="trim-chart__empty">Could not load appointments.</p>
          ) : upcoming.length === 0 ? (
            <p className="trim-chart__empty">
              New requests will appear here with the customer and the service.
            </p>
          ) : (
            <ul className="trim-saved">
              {upcoming.map((booking) => (
                <li className="trim-saved__row" key={booking.id}>
                  <BookingAvatar
                    src={booking.customerAvatarUrl}
                    name={booking.customerName}
                    className="trim-book-avatar--row"
                  />
                  <span className="trim-saved__text">
                    <span className="trim-saved__name">{booking.customerName}</span>
                    <span className="trim-saved__meta">
                      {booking.service} · {formatBookingWhen(booking.startsAt)} ·{' '}
                      {formatMoney(booking.price)}
                    </span>
                  </span>
                  <BookingStatusPill status={booking.status} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
};

export default Overview;
