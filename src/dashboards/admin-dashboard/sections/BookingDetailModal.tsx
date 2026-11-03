import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';

import { BookingStatusPill } from '../../booking/BookingStatus';
import {
  SHOP_TIME_ZONE,
  formatBookingWhen,
  formatMoney,
  statusLabel,
} from '../../booking/format';
import type { Booking } from '../../booking/types';
import '../../booking/booking.css';
import AccountAvatar from '../AccountAvatar';

interface BookingDetailModalProps {
  /** The selected booking, or null when the dialog is closed. */
  booking: Booking | null;
  avatarUrl: string | null;
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
 * Read-only full record for one appointment. Opened from a booking row.
 *
 * Portalled to document.body, matching the booking form and ConfirmModal: the
 * dashboard lives inside IonContent, and a transformed ancestor would otherwise
 * become the containing block for a fixed-position overlay.
 */
const BookingDetailModal: React.FC<BookingDetailModalProps> = ({
  booking,
  avatarUrl,
  onDismiss,
}) => {
  const titleId = useId();
  const descriptionId = useId();
  const cardRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const dismissRef = useRef(onDismiss);
  const bookingId = booking?.id ?? null;

  useEffect(() => {
    dismissRef.current = onDismiss;
  }, [onDismiss]);

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
            <p className="trim-book-modal__eyebrow">
              {booking.status === 'completed'
                ? 'Completed appointment'
                : booking.status === 'cancelled'
                  ? 'Cancelled appointment'
                  : 'Appointment'}
            </p>
            <h2 className="trim-book-modal__title" id={titleId}>
              {booking.service}
            </h2>
            <p className="trim-book-modal__lede" id={descriptionId}>
              {formatBookingWhen(booking.startsAt)} · {formatMoney(booking.price)} ·{' '}
              {booking.durationMinutes} min
            </p>
          </div>

          <button
            ref={closeRef}
            type="button"
            className="trim-book-modal__close"
            aria-label="Close booking details"
            onClick={onDismiss}
          >
            <span aria-hidden="true">×</span>
          </button>
        </header>

        <div className="trim-admin-modal__customer">
          <AccountAvatar
            src={avatarUrl}
            name={booking.customerName}
            className="trim-avatar--lg"
          />

          <div className="trim-admin-modal__identity">
            <p className="trim-admin-modal__name">{booking.customerName}</p>
            <p className="trim-admin-modal__meta">
              {booking.customerEmail ?? 'No email on file'}
            </p>
            <p className="trim-admin-modal__meta">{booking.customerPhone}</p>
          </div>

          <BookingStatusPill status={booking.status} />
        </div>

        <dl className="trim-facts trim-facts--spaced">
          <div>
            <dt>When</dt>
            <dd>{formatBookingWhen(booking.startsAt)}</dd>
          </div>
          <div>
            <dt>Barber</dt>
            <dd>{booking.barberName}</dd>
          </div>
          <div>
            <dt>Shop</dt>
            <dd>{booking.shop}</dd>
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
          <div className="trim-facts__wide">
            <dt>Booking reference</dt>
            <dd>{booking.id}</dd>
          </div>
        </dl>

        <section className="trim-admin-modal__notes">
          <h3 className="trim-admin-modal__subhead">Customer notes</h3>
          <p>
            {booking.notes?.trim()
              ? booking.notes
              : 'No notes were left with this booking.'}
          </p>
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

export default BookingDetailModal;
