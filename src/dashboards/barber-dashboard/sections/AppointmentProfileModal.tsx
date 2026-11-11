import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { useAuth } from '../../../auth/AuthProvider';
import BookingAvatar from '../../booking/BookingAvatar';
import { BookingStatusPill } from '../../booking/BookingStatus';
import {
  SHOP_TIME_ZONE,
  formatBookingWhen,
  formatMoney,
  statusLabel,
} from '../../booking/format';
import type { Booking } from '../../booking/types';
import '../../booking/booking.css';

interface AppointmentProfileModalProps {
  /** The selected appointment, or null when the dialog is closed. */
  booking: Booking | null;
  onDismiss: () => void;
}

const STAMP = new Intl.DateTimeFormat('en-PH', {
  timeZone: SHOP_TIME_ZONE,
  dateStyle: 'medium',
  timeStyle: 'short',
});

const formatStamp = (iso: string): string => {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '—' : STAMP.format(date);
};

/**
 * The customer's profile card for one appointment: picture, contact details,
 * the service booked, the notes and the chair availability the customer sees
 * when choosing a barber.
 *
 * Portalled to document.body, matching the other dashboards' dialogs: the page
 * lives inside IonContent, and a transformed ancestor would otherwise become
 * the containing block for a fixed-position overlay.
 */
const AppointmentProfileModal: React.FC<AppointmentProfileModalProps> = ({
  booking,
  onDismiss,
}) => {
  const { profile, saveAvailability } = useAuth();
  const titleId = useId();
  const descriptionId = useId();
  const cardRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const dismissRef = useRef(onDismiss);
  const bookingId = booking?.id ?? null;

  const [availabilityError, setAvailabilityError] = useState<string | null>(null);
  const [isSavingAvailability, setIsSavingAvailability] = useState(false);

  const isAvailable = profile?.isAvailable !== false;
  const barberName =
    profile?.displayName?.trim() || profile?.username || 'Trim barber';

  useEffect(() => {
    dismissRef.current = onDismiss;
  }, [onDismiss]);

  useEffect(() => {
    setAvailabilityError(null);
    setIsSavingAvailability(false);
  }, [bookingId]);

  // Move focus into the dialog and return it to the row control on close.
  useEffect(() => {
    if (!bookingId) return undefined;

    const previous = document.activeElement;
    closeRef.current?.focus();

    return () => {
      if (previous instanceof HTMLElement) previous.focus();
    };
  }, [bookingId]);

  // Escape closes, Tab stays inside the card, and the page behind cannot
  // scroll. The dashboard remains mounted under the scrim.
  useEffect(() => {
    if (!bookingId) return undefined;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        dismissRef.current();
        return;
      }
      if (event.key !== 'Tab') return;

      const focusable = cardRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable || focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (!cardRef.current?.contains(document.activeElement)) {
        event.preventDefault();
        first.focus();
        return;
      }

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [bookingId]);

  if (!booking) return null;

  const toggleAvailability = async () => {
    setAvailabilityError(null);
    setIsSavingAvailability(true);
    const result = await saveAvailability(!isAvailable);
    if (!result.ok) {
      setAvailabilityError(result.error ?? 'Could not update availability.');
    }
    setIsSavingAvailability(false);
  };

  return createPortal(
    <div className="trim-book-modal">
      <div
        className="trim-book-modal__scrim"
        aria-hidden="true"
        onClick={onDismiss}
      />

      <div
        ref={cardRef}
        className="trim-book-modal__card"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
      >
        <header className="trim-book-modal__head">
          <div>
            <p className="trim-book-modal__eyebrow">Customer profile</p>
            <h2 className="trim-book-modal__title" id={titleId}>
              {booking.customerName}
            </h2>
            <p className="trim-book-modal__lede" id={descriptionId}>
              {booking.service} · {formatBookingWhen(booking.startsAt)}
            </p>
          </div>

          <button
            ref={closeRef}
            type="button"
            className="trim-book-modal__close"
            aria-label="Close customer profile"
            onClick={onDismiss}
          >
            <span aria-hidden="true">×</span>
          </button>
        </header>

        <div className="trim-barber-modal__customer">
          <BookingAvatar
            src={booking.customerAvatarUrl}
            name={booking.customerName}
            className="trim-book-avatar--lg"
          />

          <div className="trim-barber-modal__identity">
            <p className="trim-barber-modal__name">{booking.customerName}</p>
            <p className="trim-barber-modal__meta">
              {booking.customerEmail ?? 'No email on file'}
            </p>
            <p className="trim-barber-modal__meta">{booking.customerPhone ?? 'No phone on file'}</p>
          </div>

          <BookingStatusPill status={booking.status} />
        </div>

        <dl className="trim-facts trim-facts--spaced">
          <div>
            <dt>Service</dt>
            <dd>{booking.service}</dd>
          </div>
          <div>
            <dt>When</dt>
            <dd>{formatBookingWhen(booking.startsAt)}</dd>
          </div>
          <div>
            <dt>Price</dt>
            <dd>{formatMoney(booking.price)}</dd>
          </div>
          <div>
            <dt>Duration</dt>
            <dd>{booking.durationMinutes} minutes</dd>
          </div>
          <div>
            <dt>Shop</dt>
            <dd>{booking.shop}</dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd>{statusLabel(booking.status)}</dd>
          </div>
          <div>
            <dt>Booked</dt>
            <dd>{formatStamp(booking.createdAt)}</dd>
          </div>
          <div>
            <dt>Last update</dt>
            <dd>{formatStamp(booking.updatedAt)}</dd>
          </div>
        </dl>

        <section className="trim-barber-modal__notes">
          <h3 className="trim-barber-modal__subhead">Customer notes</h3>
          <p>
            {booking.notes?.trim()
              ? booking.notes
              : 'No notes were left with this booking.'}
          </p>
        </section>

        <section className="trim-barber-modal__chair">
          <h3 className="trim-barber-modal__subhead">Your chair</h3>

          <div className="trim-barber-profile">
            <div className="trim-barber-profile__identity">
              <BookingAvatar
                src={profile?.avatarUrl}
                name={barberName}
                className="trim-book-avatar--row"
              />
              <div className="trim-barber-profile__text">
                <p className="trim-barber-profile__name">{barberName}</p>
                <p className="trim-barber-profile__meta">
                  {profile?.username ? `@${profile.username}` : 'Barber'}
                </p>
              </div>
            </div>

            <button
              type="button"
              className={`trim-barber-profile__toggle${
                isAvailable ? '' : ' trim-barber-profile__toggle--away'
              }`}
              aria-pressed={isAvailable}
              disabled={isSavingAvailability}
              onClick={() => void toggleAvailability()}
            >
              {isSavingAvailability
                ? 'Saving…'
                : isAvailable
                  ? 'Mark not available'
                  : 'Mark available'}
            </button>

            <p className="trim-barber-profile__hint">
              {isAvailable
                ? 'Customers can choose you when they book.'
                : 'Your profile is shown as not available on the customer booking form.'}
            </p>

            {availabilityError ? (
              <p className="trim-barber-profile__error" role="alert">
                {availabilityError}
              </p>
            ) : null}
          </div>
        </section>

        <div className="trim-book-form__actions">
          <button type="button" className="trim-book-form__cancel" onClick={onDismiss}>
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default AppointmentProfileModal;
