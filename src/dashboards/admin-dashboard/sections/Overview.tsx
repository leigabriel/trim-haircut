import { useMemo } from 'react';

import { roleLabel } from '../../../auth/roles';
import { formatBookingWhen, formatMoney } from '../../booking/format';
import type { BookingsState } from '../../booking/types';
import '../../shell/charts.css';
import SectionHead from '../../shell/SectionHead';
import AccountAvatar from '../AccountAvatar';
import {
  adminSummary,
  monthlyBookings,
  monthlySignups,
  newestAccounts,
  statusCounts,
  topBarbers,
  upcomingBookings,
} from '../stats';
import type { AccountsState } from '../useAccounts';

interface AdminOverviewProps {
  accounts: AccountsState;
  bookings: BookingsState;
}

const joined = (iso: string): string => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

const signupAriaLabel = (points: ReturnType<typeof monthlySignups>): string =>
  points.map((point) => `${point.label}: ${point.count}`).join('. ');

const bookingAriaLabel = (points: ReturnType<typeof monthlyBookings>): string =>
  points
    .map(
      (point) =>
        `${point.label}: ${point.completed} completed, ${
          point.requested + point.confirmed
        } scheduled, ${point.cancelled} cancelled`,
    )
    .join('. ');

const SignupChart: React.FC<{
  accounts: AccountsState;
  points: ReturnType<typeof monthlySignups>;
}> = ({ accounts, points }) => {
  const total = points.reduce((sum, point) => sum + point.count, 0);
  const max = Math.max(1, ...points.map((point) => point.count));

  return (
    <section className="trim-card trim-chart">
      <div className="trim-chart__head">
        <div>
          <h2 className="trim-card__title">New accounts</h2>
          <p className="trim-chart__summary">
            {accounts.isLoading
              ? 'Reading the profiles table…'
              : accounts.error
                ? 'Account history is unavailable'
                : total === 0
                  ? 'No sign-ups in the last six months'
                  : `${total} new ${total === 1 ? 'account' : 'accounts'} in six months`}
          </p>
        </div>
        <span className="trim-chart__window">6 months</span>
      </div>

      {accounts.isLoading ? (
        <p className="trim-chart__empty">Loading account history…</p>
      ) : accounts.error ? (
        <p className="trim-chart__empty">Could not load account history.</p>
      ) : total === 0 ? (
        <p className="trim-chart__empty">
          No accounts were created in this window. New sign-ups will appear here.
        </p>
      ) : (
        <div
          className="trim-chart__plot"
          role="img"
          aria-label={`New accounts. ${signupAriaLabel(points)}.`}
        >
          {points.map((point) => {
            const height = Math.max(0, (point.count / max) * 100);

            return (
              <div
                className="trim-chart__col"
                key={point.key}
                title={`${point.label}: ${point.count} new ${
                  point.count === 1 ? 'account' : 'accounts'
                }`}
              >
                <div className="trim-chart__track">
                  {point.count > 0 ? (
                    <span
                      className="trim-chart__value"
                      style={{ bottom: `calc(${height}% + 0.3rem)` }}
                    >
                      {point.count}
                    </span>
                  ) : null}
                  <div className="trim-chart__stack" style={{ height: `${height}%` }}>
                    {point.count > 0 ? (
                      <span className="trim-chart__bar trim-chart__bar--chat" />
                    ) : null}
                  </div>
                </div>
                <span className="trim-chart__label">{point.label}</span>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};

const BookingChart: React.FC<{
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
    <section className="trim-card trim-chart trim-admin__wide">
      <div className="trim-chart__head">
        <div>
          <h2 className="trim-card__title">Booking activity</h2>
          <p className="trim-chart__summary">
            {bookings.isLoading
              ? 'Reading appointments…'
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
          No appointments fall in this window. Bookings will appear here as soon
          as customers request a chair.
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
                  : `${total} ${total === 1 ? 'appointment' : 'appointments'} in the system`}
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
        <ul className="trim-admin-bars">
          {counts.map((entry) => (
            <li
              className="trim-admin-bars__item"
              key={entry.status}
              title={`${entry.label}: ${entry.count} ${
                entry.count === 1 ? 'appointment' : 'appointments'
              }`}
            >
              <div className="trim-admin-bars__head">
                <span>{entry.label}</span>
                <span className="trim-admin-bars__count">
                  {entry.count} · {Math.round((entry.count / total) * 100)}%
                </span>
              </div>
              <div className="trim-admin-bars__track">
                <span
                  className={`trim-admin-bars__fill trim-admin-bars__fill--${entry.status}`}
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

const BarberList: React.FC<{
  bookings: BookingsState;
  barbers: ReturnType<typeof topBarbers>;
}> = ({ bookings, barbers }) => {
  const max = Math.max(1, ...barbers.map((barber) => barber.count));

  return (
    <section className="trim-card">
      <div className="trim-chart__head">
        <div>
          <h2 className="trim-card__title">Busiest barbers</h2>
          <p className="trim-chart__summary">
            {bookings.isLoading
              ? 'Reading appointments…'
              : bookings.error
                ? 'Barber activity is unavailable'
                : barbers.length === 0
                  ? 'No appointments assigned yet'
                  : `${barbers.length} ranked by appointments booked`}
          </p>
        </div>
      </div>

      {bookings.isLoading ? (
        <p className="trim-chart__empty">Loading barber activity…</p>
      ) : bookings.error ? (
        <p className="trim-chart__empty">Could not load barber activity.</p>
      ) : barbers.length === 0 ? (
        <p className="trim-chart__empty">
          Once customers book a chair, the busiest barbers will rank here.
        </p>
      ) : (
        <ul className="trim-admin-bars">
          {barbers.map((barber) => (
            <li
              className="trim-admin-bars__item"
              key={barber.key}
              title={`${barber.name}: ${barber.count} ${
                barber.count === 1 ? 'booking' : 'bookings'
              }`}
            >
              <div className="trim-admin-bars__head">
                <span>{barber.name}</span>
                <span className="trim-admin-bars__count">
                  {barber.count} {barber.count === 1 ? 'booking' : 'bookings'}
                </span>
              </div>
              <div className="trim-admin-bars__track">
                <span
                  className="trim-admin-bars__fill"
                  style={{ width: `${(barber.count / max) * 100}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};

/**
 * Admin landing section. Every figure is counted from the two live reads the
 * dashboard already owns — accounts and bookings — so an unapplied migration
 * reads as "—" rather than a plausible zero. There is no chart library: the
 * bars are CSS, which keeps the overview in the dashboard's own type and colour
 * system and keeps a new dependency out of the bundle.
 */
const AdminOverview: React.FC<AdminOverviewProps> = ({ accounts, bookings }) => {
  const summary = useMemo(
    () => adminSummary(accounts.accounts, bookings.bookings),
    [accounts.accounts, bookings.bookings],
  );
  const signupPoints = useMemo(
    () => monthlySignups(accounts.accounts),
    [accounts.accounts],
  );
  const bookingPoints = useMemo(
    () => monthlyBookings(bookings.bookings),
    [bookings.bookings],
  );
  const statuses = useMemo(() => statusCounts(bookings.bookings), [bookings.bookings]);
  const barbers = useMemo(() => topBarbers(bookings.bookings), [bookings.bookings]);
  const newest = useMemo(() => newestAccounts(accounts.accounts), [accounts.accounts]);
  const upcoming = useMemo(
    () => upcomingBookings(bookings.bookings),
    [bookings.bookings],
  );
  const avatars = useMemo(
    () => new Map(accounts.accounts.map((account) => [account.id, account.avatarUrl])),
    [accounts.accounts],
  );

  const accountValue = (count: number): string => {
    if (accounts.isLoading) return '…';
    if (accounts.error) return '—';
    return String(count);
  };

  const bookingValue = (value: number | string): string => {
    if (bookings.isLoading) return '…';
    if (bookings.error) return '—';
    return typeof value === 'number' ? String(value) : value;
  };

  return (
    <>
      <SectionHead
        title="Overview"
        lede="Accounts, chairs and appointments across Trim, read as one picture. Every number comes from the live account and booking lists."
      />

      <ul className="trim-metrics">
        <li className="trim-metric">
          <p className="trim-metric__label">Accounts</p>
          <p className="trim-metric__value">{accountValue(summary.accounts)}</p>
          <p className="trim-metric__delta">
            {accounts.isLoading
              ? 'Reading the profiles table'
              : accounts.error
                ? 'Account list unavailable'
                : `${summary.customers} customers · ${summary.admins} admins`}
          </p>
        </li>

        <li className="trim-metric">
          <p className="trim-metric__label">Barbers</p>
          <p className="trim-metric__value">{accountValue(summary.barbers)}</p>
          <p className="trim-metric__delta">Can run a chair</p>
        </li>

        <li className="trim-metric">
          <p className="trim-metric__label">Bookings</p>
          <p className="trim-metric__value">{bookingValue(summary.bookings)}</p>
          <p className="trim-metric__delta">
            {bookings.isLoading
              ? 'Reading appointments'
              : bookings.error
                ? 'Booking list unavailable'
                : `${summary.upcoming} upcoming · ${summary.completed} completed`}
          </p>
        </li>

        <li className="trim-metric">
          <p className="trim-metric__label">Revenue</p>
          <p className="trim-metric__value">
            {bookingValue(formatMoney(summary.revenue))}
          </p>
          <p className="trim-metric__delta">Completed cuts only</p>
        </li>
      </ul>

      {accounts.error ? (
        <div className="trim-card trim-card--danger">
          <h2 className="trim-card__title">Account list unavailable</h2>
          <p className="trim-card__text">{accounts.error}</p>
          <button
            className="trim-account__analyze"
            type="button"
            onClick={() => void accounts.reload()}
          >
            Try again
          </button>
        </div>
      ) : null}

      {bookings.error ? (
        <div className="trim-card trim-card--danger">
          <h2 className="trim-card__title">Booking list unavailable</h2>
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

      <div className="trim-admin__grid">
        <BookingChart bookings={bookings} points={bookingPoints} />
        <SignupChart accounts={accounts} points={signupPoints} />
        <StatusSplit bookings={bookings} counts={statuses} />
        <BarberList bookings={bookings} barbers={barbers} />

        <section className="trim-card">
          <div className="trim-chart__head">
            <div>
              <h2 className="trim-card__title">Newest accounts</h2>
              <p className="trim-chart__summary">
                {accounts.isLoading
                  ? 'Reading the profiles table…'
                  : accounts.error
                    ? 'Account list is unavailable'
                    : newest.length === 0
                      ? 'No accounts yet'
                      : `The ${newest.length} most recent ${
                          newest.length === 1 ? 'sign-up' : 'sign-ups'
                        }`}
              </p>
            </div>
          </div>

          {accounts.isLoading ? (
            <p className="trim-chart__empty">Reading accounts…</p>
          ) : accounts.error ? (
            <p className="trim-chart__empty">Could not load accounts.</p>
          ) : newest.length === 0 ? (
            <p className="trim-chart__empty">
              New accounts will appear here as customers join Trim.
            </p>
          ) : (
            <ul className="trim-saved">
              {newest.map((account) => {
                const name = account.username ?? account.displayName ?? 'No username';

                return (
                  <li className="trim-saved__row" key={account.id}>
                    <AccountAvatar
                      src={account.avatarUrl}
                      name={name}
                      className="trim-avatar--row"
                    />
                    <span className="trim-saved__text">
                      <span className="trim-saved__name">{name}</span>
                      <span className="trim-saved__meta">
                        {account.email} · {roleLabel(account.role)} · joined{' '}
                        {joined(account.createdAt)}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="trim-card trim-admin__wide">
          <div className="trim-chart__head">
            <div>
              <h2 className="trim-card__title">Upcoming appointments</h2>
              <p className="trim-chart__summary">
                {bookings.isLoading
                  ? 'Reading appointments…'
                  : bookings.error
                    ? 'Booking list is unavailable'
                    : upcoming.length === 0
                      ? 'The chair is open'
                      : `${upcoming.length} of ${summary.upcoming} upcoming ${
                          summary.upcoming === 1 ? 'booking' : 'bookings'
                        }`}
              </p>
            </div>
          </div>

          {bookings.isLoading ? (
            <p className="trim-chart__empty">Reading appointments…</p>
          ) : bookings.error ? (
            <p className="trim-chart__empty">Could not load appointments.</p>
          ) : upcoming.length === 0 ? (
            <p className="trim-chart__empty">
              Nothing is booked yet. New requests will show here with the
              customer and the service.
            </p>
          ) : (
            <ul className="trim-saved">
              {upcoming.map((booking) => (
                <li className="trim-saved__row" key={booking.id}>
                  <AccountAvatar
                    src={avatars.get(booking.customerId) ?? null}
                    name={booking.customerName}
                    className="trim-avatar--row"
                  />
                  <span className="trim-saved__text">
                    <span className="trim-saved__name">{booking.customerName}</span>
                    <span className="trim-saved__meta">
                      {booking.service} · {formatBookingWhen(booking.startsAt)} ·{' '}
                      {booking.barberName}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
};

export default AdminOverview;
