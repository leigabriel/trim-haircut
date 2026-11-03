import { useMemo, useState } from 'react';
import { DocumentDownload } from 'reicon-react';

import { roleLabel } from '../../../auth/roles';
import { BookingStatusPill } from '../../booking/BookingStatus';
import {
  formatBookingWhen,
  formatMoney,
  shopDateKey,
  shopToday,
  statusLabel,
} from '../../booking/format';
import type { BookingsState } from '../../booking/types';
import '../../shell/charts.css';
import SectionHead from '../../shell/SectionHead';
import {
  RANGE_PRESETS,
  accountsInRange,
  barberTallies,
  bookingsInRange,
  formatReportDate,
  isValidRange,
  reportRangeLabel,
  reportSummary,
  serviceTallies,
  statusTallies,
  type ReportRange,
} from '../report';
import { downloadReportPdf } from '../reportPdf';
import type { AccountsState } from '../useAccounts';

interface ReportsProps {
  accounts: AccountsState;
  bookings: BookingsState;
}

const count = (value: number, loading: boolean, error: boolean): string => {
  if (loading) return '…';
  if (error) return '—';
  return String(value);
};

const money = (value: number, loading: boolean, error: boolean): string => {
  if (loading) return '…';
  if (error) return '—';
  return formatMoney(value);
};

/**
 * Business report for a chosen date window. Every figure is counted from the
 * same account and booking reads the rest of the admin dashboard uses; the PDF
 * is generated on demand and the library is loaded only for that click.
 */
const Reports: React.FC<ReportsProps> = ({ accounts, bookings }) => {
  const today = shopToday();
  const [range, setRange] = useState<ReportRange>(() =>
    RANGE_PRESETS[1].range(today),
  );
  const [activePreset, setActivePreset] = useState<string | null>('30d');
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const validRange = isValidRange(range);
  const isLoading = accounts.isLoading || bookings.isLoading;
  const hasAccountError = Boolean(accounts.error);
  const hasBookingError = Boolean(bookings.error);

  const rangeBookings = useMemo(
    () => (validRange ? bookingsInRange(bookings.bookings, range) : []),
    [bookings.bookings, range, validRange],
  );
  const newAccounts = useMemo(
    () => (validRange ? accountsInRange(accounts.accounts, range) : []),
    [accounts.accounts, range, validRange],
  );
  const summary = useMemo(
    () => reportSummary(rangeBookings, newAccounts.length),
    [rangeBookings, newAccounts.length],
  );
  const statuses = useMemo(() => statusTallies(rangeBookings), [rangeBookings]);
  const services = useMemo(() => serviceTallies(rangeBookings), [rangeBookings]);
  const barbers = useMemo(() => barberTallies(rangeBookings), [rangeBookings]);
  const statusTotal = statuses.reduce((sum, entry) => sum + entry.count, 0);

  const choosePreset = (presetId: string) => {
    const preset = RANGE_PRESETS.find((entry) => entry.id === presetId);
    if (!preset) return;
    setRange(preset.range(today));
    setActivePreset(preset.id);
    setExportError(null);
  };

  const changeDate = (side: 'from' | 'to', value: string) => {
    setRange((current) => ({ ...current, [side]: value }));
    setActivePreset(null);
    setExportError(null);
  };

  const exportReport = async () => {
    if (!validRange || isLoading || hasAccountError || hasBookingError) return;

    setIsExporting(true);
    setExportError(null);

    try {
      await downloadReportPdf({
        range,
        bookings: rangeBookings,
        newAccounts,
        summary,
        statuses,
        services,
        barbers,
        generatedAt: new Date(),
      });
    } catch (cause) {
      console.error('Could not build the report PDF', cause);
      setExportError('Could not build the PDF. Try again in a moment.');
    } finally {
      setIsExporting(false);
    }
  };

  const canExport =
    validRange && !isLoading && !hasAccountError && !hasBookingError;

  return (
    <>
      <SectionHead
        title="Reports"
        lede="A date-bounded view of appointments, revenue and accounts. Set the period, review the figures, then export a formatted PDF."
      />

      <section className="trim-card trim-report__toolbar" aria-label="Report period">
        <div className="trim-report__controls">
          <div className="trim-report__presets" role="group" aria-label="Quick periods">
            {RANGE_PRESETS.map((preset) => (
              <button
                key={preset.id}
                className={`trim-report__preset${
                  activePreset === preset.id ? ' trim-report__preset--active' : ''
                }`}
                type="button"
                aria-pressed={activePreset === preset.id}
                onClick={() => choosePreset(preset.id)}
              >
                {preset.label}
              </button>
            ))}
          </div>

          <label className="trim-report__field">
            <span>From</span>
            <input
              type="date"
              value={range.from}
              max={range.to || undefined}
              onChange={(event) => changeDate('from', event.target.value)}
            />
          </label>

          <label className="trim-report__field">
            <span>To</span>
            <input
              type="date"
              value={range.to}
              min={range.from || undefined}
              onChange={(event) => changeDate('to', event.target.value)}
            />
          </label>
        </div>

        <div className="trim-report__actions">
          <p className="trim-report__period">{reportRangeLabel(range)}</p>
          <button
            className="trim-report__export"
            type="button"
            disabled={!canExport || isExporting}
            onClick={() => void exportReport()}
          >
            <DocumentDownload size={16} aria-hidden="true" />
            {isExporting ? 'Building PDF…' : 'Export PDF'}
          </button>
        </div>
      </section>

      {!validRange ? (
        <p className="trim-report__error" role="alert">
          The start date must be on or before the end date.
        </p>
      ) : null}

      {exportError ? (
        <p className="trim-report__error" role="alert">
          {exportError}
        </p>
      ) : null}

      {hasAccountError || hasBookingError ? (
        <p className="trim-report__note">
          The report waits for both live reads. Resolve the errors below before
          exporting so the PDF cannot under-count.
        </p>
      ) : null}

      {hasAccountError ? (
        <div className="trim-card trim-card--danger">
          <h2 className="trim-card__title">Account data unavailable</h2>
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

      {hasBookingError ? (
        <div className="trim-card trim-card--danger">
          <h2 className="trim-card__title">Booking data unavailable</h2>
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

      <ul className="trim-metrics">
        <li className="trim-metric">
          <p className="trim-metric__label">Appointments</p>
          <p className="trim-metric__value">
            {count(summary.bookings, bookings.isLoading, hasBookingError)}
          </p>
          <p className="trim-metric__delta">In the selected period</p>
        </li>
        <li className="trim-metric">
          <p className="trim-metric__label">Completed</p>
          <p className="trim-metric__value">
            {count(summary.completed, bookings.isLoading, hasBookingError)}
          </p>
          <p className="trim-metric__delta">
            {bookings.isLoading
              ? 'Reading appointments…'
              : hasBookingError
                ? 'Status split unavailable'
                : `${summary.scheduled} scheduled · ${summary.cancelled} cancelled`}
          </p>
        </li>
        <li className="trim-metric">
          <p className="trim-metric__label">Revenue</p>
          <p className="trim-metric__value">
            {money(summary.revenue, bookings.isLoading, hasBookingError)}
          </p>
          <p className="trim-metric__delta">Completed cuts only</p>
        </li>
        <li className="trim-metric">
          <p className="trim-metric__label">New accounts</p>
          <p className="trim-metric__value">
            {count(newAccounts.length, accounts.isLoading, hasAccountError)}
          </p>
          <p className="trim-metric__delta">Joined in this period</p>
        </li>
      </ul>

      <div className="trim-admin__grid trim-report__grid">
        <section className="trim-card">
          <div className="trim-chart__head">
            <div>
              <h2 className="trim-card__title">Booking status</h2>
              <p className="trim-chart__summary">
                {bookings.isLoading
                  ? 'Reading appointments…'
                  : hasBookingError
                    ? 'Status split is unavailable'
                    : statusTotal === 0
                      ? 'No appointments in this period'
                      : `${statusTotal} ${
                          statusTotal === 1 ? 'appointment' : 'appointments'
                        } in the period`}
              </p>
            </div>
          </div>

          {bookings.isLoading ? (
            <p className="trim-chart__empty">Loading the status split…</p>
          ) : hasBookingError ? (
            <p className="trim-chart__empty">Could not load the status split.</p>
          ) : statusTotal === 0 ? (
            <p className="trim-chart__empty">
              Requested, confirmed, completed and cancelled counts will appear
              here when appointments fall in the period.
            </p>
          ) : (
            <ul className="trim-admin-bars">
              {statuses.map((entry) => (
                <li
                  className="trim-admin-bars__item"
                  key={entry.status}
                  title={`${entry.label}: ${entry.count} appointments`}
                >
                  <div className="trim-admin-bars__head">
                    <span>{entry.label}</span>
                    <span className="trim-admin-bars__count">
                      {entry.count} · {Math.round((entry.count / statusTotal) * 100)}%
                    </span>
                  </div>
                  <div className="trim-admin-bars__track">
                    <span
                      className={`trim-admin-bars__fill trim-admin-bars__fill--${entry.status}`}
                      style={{ width: `${(entry.count / statusTotal) * 100}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="trim-card">
          <div className="trim-chart__head">
            <div>
              <h2 className="trim-card__title">Services</h2>
              <p className="trim-chart__summary">
                {bookings.isLoading
                  ? 'Reading appointments…'
                  : hasBookingError
                    ? 'Service breakdown is unavailable'
                    : services.length === 0
                      ? 'No services booked in this period'
                      : `${services.length} ${
                          services.length === 1 ? 'service' : 'services'
                        } booked`}
              </p>
            </div>
          </div>

          {bookings.isLoading ? (
            <p className="trim-chart__empty">Loading the service mix…</p>
          ) : hasBookingError ? (
            <p className="trim-chart__empty">Could not load the service mix.</p>
          ) : services.length === 0 ? (
            <p className="trim-chart__empty">
              Service counts and completed revenue will appear here.
            </p>
          ) : (
            <div className="trim-report__table-wrap">
              <table className="trim-table trim-report__table">
                <caption className="trim-visually-hidden">
                  Services booked in the selected period
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Service</th>
                    <th scope="col" className="trim-table__num">
                      Booked
                    </th>
                    <th scope="col" className="trim-table__num">
                      Revenue
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {services.map((entry) => (
                    <tr key={entry.service}>
                      <td data-label="Service">{entry.service}</td>
                      <td data-label="Booked" className="trim-table__num">
                        {entry.count}
                      </td>
                      <td data-label="Revenue" className="trim-table__num">
                        {formatMoney(entry.revenue)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="trim-card trim-admin__wide">
          <div className="trim-chart__head">
            <div>
              <h2 className="trim-card__title">Barber performance</h2>
              <p className="trim-chart__summary">
                {bookings.isLoading
                  ? 'Reading appointments…'
                  : hasBookingError
                    ? 'Barber performance is unavailable'
                    : barbers.length === 0
                      ? 'No barber activity in this period'
                      : `${barbers.length} ${
                          barbers.length === 1 ? 'barber' : 'barbers'
                        } with appointments`}
              </p>
            </div>
          </div>

          {bookings.isLoading ? (
            <p className="trim-chart__empty">
              Loading barber performance…
            </p>
          ) : hasBookingError ? (
            <p className="trim-chart__empty">
              Could not load barber performance.
            </p>
          ) : barbers.length === 0 ? (
            <p className="trim-chart__empty">
              Once appointments fall in this period, each barber's bookings and
              completed revenue will appear here.
            </p>
          ) : (
            <div className="trim-report__table-wrap">
              <table className="trim-table trim-report__table">
                <caption className="trim-visually-hidden">
                  Barber appointments and completed revenue
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Barber</th>
                    <th scope="col" className="trim-table__num">
                      Booked
                    </th>
                    <th scope="col" className="trim-table__num">
                      Completed
                    </th>
                    <th scope="col" className="trim-table__num">
                      Revenue
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {barbers.map((barber) => (
                    <tr key={barber.key}>
                      <td data-label="Barber">{barber.name}</td>
                      <td data-label="Booked" className="trim-table__num">
                        {barber.count}
                      </td>
                      <td data-label="Completed" className="trim-table__num">
                        {barber.completed}
                      </td>
                      <td data-label="Revenue" className="trim-table__num">
                        {formatMoney(barber.revenue)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="trim-card trim-admin__wide">
          <div className="trim-chart__head">
            <div>
              <h2 className="trim-card__title">New accounts</h2>
              <p className="trim-chart__summary">
                {accounts.isLoading
                  ? 'Reading accounts…'
                  : hasAccountError
                    ? 'New account list is unavailable'
                    : newAccounts.length === 0
                      ? 'No accounts joined in this period'
                      : `${newAccounts.length} ${
                          newAccounts.length === 1 ? 'account' : 'accounts'
                        } joined`}
              </p>
            </div>
          </div>

          {accounts.isLoading ? (
            <p className="trim-chart__empty">Loading new accounts…</p>
          ) : hasAccountError ? (
            <p className="trim-chart__empty">Could not load new accounts.</p>
          ) : newAccounts.length === 0 ? (
            <p className="trim-chart__empty">
              Sign-ups inside the selected dates will appear here.
            </p>
          ) : (
            <div className="trim-report__table-wrap">
              <table className="trim-table trim-report__table">
                <caption className="trim-visually-hidden">
                  Accounts created in the selected period
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Account</th>
                    <th scope="col">Email</th>
                    <th scope="col">Role</th>
                    <th scope="col">Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {newAccounts.map((account) => (
                    <tr key={account.id}>
                      <td data-label="Account">
                        {account.username ?? account.displayName ?? 'No username'}
                      </td>
                      <td data-label="Email" className="trim-admin-email">
                        {account.email}
                      </td>
                      <td data-label="Role">{roleLabel(account.role)}</td>
                      <td data-label="Joined">
                        {formatReportDate(shopDateKey(account.createdAt))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="trim-card trim-admin__wide">
          <div className="trim-chart__head">
            <div>
              <h2 className="trim-card__title">Appointments</h2>
              <p className="trim-chart__summary">
                {bookings.isLoading
                  ? 'Reading appointments…'
                  : hasBookingError
                    ? 'Appointment ledger is unavailable'
                    : rangeBookings.length === 0
                      ? 'No appointments in this period'
                      : `${rangeBookings.length} ${
                          rangeBookings.length === 1 ? 'appointment' : 'appointments'
                        }, oldest first`}
              </p>
            </div>
            {!bookings.isLoading && !hasBookingError ? (
              <span className="trim-chart__window">{rangeBookings.length}</span>
            ) : null}
          </div>

          {bookings.isLoading ? (
            <p className="trim-chart__empty">Loading the appointment ledger…</p>
          ) : hasBookingError ? (
            <p className="trim-chart__empty">Could not load appointments.</p>
          ) : rangeBookings.length === 0 ? (
            <p className="trim-chart__empty">
              Appointments inside the selected dates will appear here with their
              customer, barber, service and status.
            </p>
          ) : (
            <div className="trim-report__table-wrap">
              <table className="trim-table trim-report__table trim-report__table--wide">
                <caption className="trim-visually-hidden">
                  Every appointment in the selected period
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
                  {rangeBookings.map((booking) => (
                    <tr key={booking.id}>
                      <td data-label="When" className="trim-report__when">
                        {formatBookingWhen(booking.startsAt)}
                      </td>
                      <td data-label="Customer">{booking.customerName}</td>
                      <td data-label="Barber">{booking.barberName}</td>
                      <td data-label="Service">
                        {booking.service}
                        <span className="trim-table__secondary">
                          {statusLabel(booking.status)} · {booking.durationMinutes} min
                        </span>
                      </td>
                      <td data-label="Price" className="trim-table__num">
                        {formatMoney(booking.price)}
                      </td>
                      <td data-label="Status">
                        <BookingStatusPill status={booking.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </>
  );
};

export default Reports;
