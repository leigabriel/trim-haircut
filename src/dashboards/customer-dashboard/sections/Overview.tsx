import { useMemo } from 'react';

import { BookingStatusPill } from '../../booking/BookingStatus';
import {
  formatBookingDate,
  formatBookingTime,
  formatMoney,
  isUpcoming,
} from '../../booking/format';
import type { BookingsState } from '../../booking/types';
import SectionHead from '../../shell/SectionHead';
import type { Conversation } from '../ai/trimo';
import { shapeAdvice } from '../face/advice';
import { faceShapeLabel } from '../face/shapes';
import type { FaceProfileState } from '../face/useFaceProfile';
import { relativeTime } from '../time';
import { monthlyBookingPoints, weeklyChatPoints } from './overviewData';
import type { MonthlyBookingPoint, WeeklyChatPoint } from './overviewData';
import './Overview.css';

interface OverviewProps {
  face: FaceProfileState;
  bookings: BookingsState;
  conversations: Conversation[];
  isConversationsLoading: boolean;
  onAnalyzeFace: () => void;
  onOpenAi: () => void;
  onOpenBooking: () => void;
}

const conversationLabel = (conversation: Conversation): string => {
  // The edge function names the row from the first question, so this is the
  // customer's own words rather than a generated label.
  const title = conversation.title?.trim();
  return title && title.length > 0 ? title : 'Untitled conversation';
};

const monthAriaLabel = (points: MonthlyBookingPoint[]): string =>
  points
    .map(
      (point) =>
        `${point.label}: ${point.completed} completed, ${point.scheduled} scheduled`,
    )
    .join('. ');

const chatAriaLabel = (points: WeeklyChatPoint[]): string =>
  points.map((point) => `${point.label}: ${point.count} active`).join('. ');

const BookingChart: React.FC<{
  points: MonthlyBookingPoint[];
  isLoading: boolean;
  error: string | null;
}> = ({ points, isLoading, error }) => {
  const total = points.reduce((sum, point) => sum + point.total, 0);
  const completed = points.reduce((sum, point) => sum + point.completed, 0);
  const scheduled = points.reduce((sum, point) => sum + point.scheduled, 0);
  const max = Math.max(1, ...points.map((point) => point.total));

  return (
    <section className="trim-card trim-chart trim-overview__wide">
      <div className="trim-chart__head">
        <div>
          <h2 className="trim-card__title">Booking activity</h2>
          <p className="trim-chart__summary">
            {isLoading
              ? 'Loading your appointments…'
              : error
                ? 'Booking history is unavailable right now'
                : total === 0
                  ? 'No activity in the last six months'
                  : `${completed} completed · ${scheduled} coming up`}
          </p>
        </div>
        <span className="trim-chart__window">6 months</span>
      </div>

      {isLoading ? (
        <p className="trim-chart__empty">Reading your booking history…</p>
      ) : error ? (
        <p className="trim-chart__empty">Could not load booking activity. Try again.</p>
      ) : total === 0 ? (
        <p className="trim-chart__empty">
          No booking activity in this window yet. Your next cut will appear here.
        </p>
      ) : (
        <div
          className="trim-chart__plot"
          role="img"
          aria-label={`Booking activity. ${monthAriaLabel(points)}.`}
        >
          {points.map((point) => {
            const height = Math.max(0, (point.total / max) * 100);
            const completedShare =
              point.total > 0 ? (point.completed / point.total) * 100 : 0;
            const scheduledShare =
              point.total > 0 ? (point.scheduled / point.total) * 100 : 0;

            return (
              <div className="trim-chart__col" key={point.key}>
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
                    {point.scheduled > 0 ? (
                      <span
                        className="trim-chart__bar trim-chart__bar--scheduled"
                        style={{ height: `${scheduledShare}%` }}
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
      </ul>
    </section>
  );
};

const ChatChart: React.FC<{
  points: WeeklyChatPoint[];
  isLoading: boolean;
}> = ({ points, isLoading }) => {
  const total = points.reduce((sum, point) => sum + point.count, 0);
  const max = Math.max(1, ...points.map((point) => point.count));
  const activeWeeks = points.filter((point) => point.count > 0).length;

  return (
    <section className="trim-card trim-chart">
      <div className="trim-chart__head">
        <div>
          <h2 className="trim-card__title">Trimo activity</h2>
          <p className="trim-chart__summary">
            {isLoading
              ? 'Loading conversations…'
              : total === 0
                ? 'No activity in the last eight weeks'
                : `${total} active ${total === 1 ? 'conversation' : 'conversations'} in ${activeWeeks} ${
                    activeWeeks === 1 ? 'week' : 'weeks'
                  }`}
          </p>
        </div>
        <span className="trim-chart__window">8 weeks</span>
      </div>

      {isLoading ? (
        <p className="trim-chart__empty">Reading your Trimo history…</p>
      ) : total === 0 ? (
        <p className="trim-chart__empty">
          Nothing yet. Ask Trimo about a cut and the activity will show here.
        </p>
      ) : (
        <div
          className="trim-chart__plot trim-chart__plot--compact"
          role="img"
          aria-label={`Trimo activity. ${chatAriaLabel(points)}.`}
        >
          {points.map((point) => {
            const height = Math.max(0, (point.count / max) * 100);

            return (
              <div className="trim-chart__col" key={point.key}>
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
                    <span className="trim-chart__bar trim-chart__bar--chat" />
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

const METER_MAX = 1.5;

const FaceReading: React.FC<{
  face: FaceProfileState;
  onAnalyzeFace: () => void;
}> = ({ face, onAnalyzeFace }) => {
  const measurements = face.profile?.measurements;
  const readings = measurements
    ? [
        { label: 'Forehead', value: measurements.foreheadRatio },
        { label: 'Cheekbones', value: 1 },
        { label: 'Jaw', value: measurements.jawRatio },
        { label: 'Length', value: measurements.lengthRatio },
      ]
    : [];

  return (
    <section className="trim-card trim-face">
      <div className="trim-chart__head">
        <div>
          <h2 className="trim-card__title">Face reading</h2>
          <p className="trim-chart__summary">
            {face.isLoading || !face.profile
              ? 'The measurements behind your recommendations.'
              : `${face.profile.source === 'scanned' ? 'Measured' : 'Set by you'} ${relativeTime(
                  face.profile.measured_at,
                )}`}
          </p>
        </div>
        {face.shape ? (
          <span className="trim-face__badge">{faceShapeLabel(face.shape)}</span>
        ) : null}
      </div>

      {face.isLoading ? (
        <p className="trim-chart__empty">Loading your reading…</p>
      ) : face.error ? (
        <>
          <p className="trim-chart__empty">{face.error}</p>
          <button
            className="trim-overview__cta"
            type="button"
            onClick={() => void face.reload()}
          >
            Try again
          </button>
        </>
      ) : !face.shape ? (
        <>
          <p className="trim-card__text trim-face__copy">
            Set your shape by hand or measure it in about twenty seconds. The
            recommendation and Trimo answers use it.
          </p>
          <button className="trim-overview__cta" type="button" onClick={onAnalyzeFace}>
            Analyze my face
          </button>
        </>
      ) : (
        <>
          <p className="trim-card__text trim-face__copy">{shapeAdvice(face.shape).body}</p>

          {readings.length > 0 ? (
            <>
              <ul className="trim-meter-list">
                {readings.map((reading) => {
                  const percent = Math.round(reading.value * 100);
                  const fill = Math.min(100, (reading.value / METER_MAX) * 100);
                  const baseline = (1 / METER_MAX) * 100;

                  return (
                    <li className="trim-meter" key={reading.label}>
                      <div className="trim-meter__head">
                        <span>{reading.label}</span>
                        <span>{percent}%</span>
                      </div>
                      <div className="trim-meter__track" aria-hidden="true">
                        <span className="trim-meter__baseline" style={{ left: `${baseline}%` }} />
                        <span className="trim-meter__fill" style={{ width: `${fill}%` }} />
                      </div>
                    </li>
                  );
                })}
              </ul>
              <p className="trim-meter__note">
                The marker is cheekbone width, the 100% reference.
              </p>
            </>
          ) : (
            <p className="trim-chart__empty">
              You picked this shape rather than measuring it, so there are no
              measurements to chart.
            </p>
          )}

          <button className="trim-overview__cta" type="button" onClick={onAnalyzeFace}>
            Update reading
          </button>
        </>
      )}
    </section>
  );
};

/**
 * Landing section, built only from what Trim genuinely knows about this
 * customer.
 *
 * Every number and every bar comes from the rows the customer can already see:
 * bookings, the face reading and Trimo conversations. There is no sample data
 * and no chart library, so the page cannot drift out of sync with the app.
 */
const Overview: React.FC<OverviewProps> = ({
  face,
  bookings,
  conversations,
  isConversationsLoading,
  onAnalyzeFace,
  onOpenAi,
  onOpenBooking,
}) => {
  const monthlyPoints = useMemo(
    () => monthlyBookingPoints(bookings.bookings),
    [bookings.bookings],
  );
  const chatPoints = useMemo(
    () => weeklyChatPoints(conversations),
    [conversations],
  );

  const completed = useMemo(
    () => bookings.bookings.filter((booking) => booking.status === 'completed'),
    [bookings.bookings],
  );
  const totalSpend = useMemo(
    () => completed.reduce((sum, booking) => sum + booking.price, 0),
    [completed],
  );
  const upcoming = useMemo(
    () =>
      bookings.bookings
        .filter(isUpcoming)
        .sort(
          (first, second) =>
            new Date(first.startsAt).getTime() - new Date(second.startsAt).getTime(),
        ),
    [bookings.bookings],
  );
  const recent = useMemo(() => conversations.slice(0, 4), [conversations]);
  const thisMonth = monthlyPoints.at(-1);
  const recentChats = useMemo(() => {
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return conversations.filter(
      (conversation) => new Date(conversation.updated_at).getTime() >= weekAgo,
    ).length;
  }, [conversations]);
  const nextBooking = upcoming[0] ?? null;

  return (
    <>
      <SectionHead
        title="Overview"
        lede="Your cuts, your reading and your Trimo history, read as one picture instead of four separate guesses."
      />

      <ul className="trim-metrics">
        <li className="trim-metric">
          <p className="trim-metric__label">Cuts completed</p>
          <p className="trim-metric__value">
            {bookings.isLoading ? '…' : bookings.error ? '—' : completed.length}
          </p>
          <p className="trim-metric__delta">
            {bookings.isLoading
              ? 'Loading history'
              : bookings.error
                ? 'Could not load history'
                : !thisMonth
                  ? 'Across your history'
                  : `${thisMonth.completed} this month`}
          </p>
        </li>

        <li className="trim-metric">
          <p className="trim-metric__label">Upcoming</p>
          <p className="trim-metric__value">
            {bookings.isLoading ? '…' : bookings.error ? '—' : upcoming.length}
          </p>
          <p className="trim-metric__delta trim-metric__delta--down">
            {bookings.isLoading
              ? 'Loading appointments'
              : bookings.error
                ? 'Could not load appointments'
                : nextBooking
                  ? `Next ${formatBookingDate(nextBooking.startsAt)}`
                  : 'Nothing booked'}
          </p>
        </li>

        <li className="trim-metric">
          <p className="trim-metric__label">Spent on cuts</p>
          <p className="trim-metric__value">
            {bookings.isLoading ? '…' : bookings.error ? '—' : formatMoney(totalSpend)}
          </p>
          <p className="trim-metric__delta">
            {bookings.isLoading
              ? 'Across your history'
              : bookings.error
                ? 'Could not load spending'
                : !thisMonth
                  ? 'Across your history'
                  : `${formatMoney(thisMonth.spend)} this month`}
          </p>
        </li>

        <li className="trim-metric">
          <p className="trim-metric__label">Trimo chats</p>
          <p className="trim-metric__value">
            {isConversationsLoading ? '…' : conversations.length}
          </p>
          <p className="trim-metric__delta">
            {isConversationsLoading
              ? 'Loading conversations'
              : recentChats > 0
                ? `${recentChats} in the last 7 days`
                : 'No new chats this week'}
          </p>
        </li>
      </ul>

      <div className="trim-overview__grid">
        <BookingChart
          points={monthlyPoints}
          isLoading={bookings.isLoading}
          error={bookings.error}
        />

        <section className="trim-card trim-overview__next">
          <div className="trim-chart__head">
            <div>
              <h2 className="trim-card__title">Next appointment</h2>
              <p className="trim-chart__summary">
                {upcoming.length > 0
                  ? `${upcoming.length} ${upcoming.length === 1 ? 'booking' : 'bookings'} on the books`
                  : 'The chair is open'}
              </p>
            </div>
          </div>

          {bookings.isLoading ? (
            <p className="trim-chart__empty">Loading your appointments…</p>
          ) : bookings.error ? (
            <p className="trim-chart__empty">Could not load your appointments. Try again.</p>
          ) : nextBooking ? (
            <>
              <p className="trim-overview__next-date">
                {formatBookingDate(nextBooking.startsAt)}
              </p>
              <p className="trim-overview__next-time">
                {formatBookingTime(nextBooking.startsAt)}
              </p>
              <dl className="trim-overview__next-meta">
                <div>
                  <dt>Service</dt>
                  <dd>{nextBooking.service}</dd>
                </div>
                <div>
                  <dt>Barber</dt>
                  <dd>{nextBooking.barberName}</dd>
                </div>
                <div>
                  <dt>Shop</dt>
                  <dd>{nextBooking.shop}</dd>
                </div>
              </dl>
              <div className="trim-overview__next-foot">
                <BookingStatusPill status={nextBooking.status} />
                <span className="trim-overview__next-price">
                  {formatMoney(nextBooking.price)}
                </span>
              </div>
              <button
                className="trim-overview__cta"
                type="button"
                onClick={onOpenBooking}
              >
                Manage booking
              </button>
            </>
          ) : (
            <>
              <p className="trim-card__text trim-face__copy">
                Pick a service and a time that works. Your next cut will show up
                here with the barber and the price.
              </p>
              <button
                className="trim-overview__cta"
                type="button"
                onClick={onOpenBooking}
              >
                Book a cut
              </button>
            </>
          )}
        </section>

        <ChatChart points={chatPoints} isLoading={isConversationsLoading} />

        <FaceReading face={face} onAnalyzeFace={onAnalyzeFace} />

        <section className="trim-card trim-overview__feed">
          <div className="trim-chart__head">
            <div>
              <h2 className="trim-card__title">Recent conversations</h2>
              <p className="trim-chart__summary">
                {conversations.length > 0
                  ? `${conversations.length} saved with Trimo`
                  : 'Your Trimo history will collect here'}
              </p>
            </div>
          </div>

          {recent.length === 0 ? (
            <p className="trim-chart__empty">
              You have not asked Trimo anything yet. Start with a style, a face
              shape or the kind of cut you want.
            </p>
          ) : (
            <ul className="trim-saved">
              {recent.map((conversation) => (
                <li className="trim-saved__row" key={conversation.id}>
                  <span className="trim-saved__text">
                    <span className="trim-saved__name">
                      {conversationLabel(conversation)}
                    </span>
                    <span className="trim-saved__meta">
                      {relativeTime(conversation.updated_at)}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}

          <button className="trim-overview__cta" type="button" onClick={onOpenAi}>
            Ask Trimo
          </button>
        </section>
      </div>
    </>
  );
};

export default Overview;
