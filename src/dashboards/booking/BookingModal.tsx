import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { createPortal } from 'react-dom';

import { useAuth } from '../../auth/AuthProvider';
import { SHOP } from '../../components/sections/Location/shop';
import { supabase } from '../../lib/supabase';
import {
  defaultBookingDate,
  formatMoney,
  isShopClosed,
  isSlotPast,
  maxBookingDate,
  readBookingError,
  shopToday,
  slotLabel,
  slotOptions,
  toShopIso,
} from './format';
import type {
  BarberOption,
  Booking,
  BookingRow,
  ServiceOption,
} from './types';
import { toBooking } from './types';
import './booking.css';

interface BookingModalProps {
  isOpen: boolean;
  onDismiss: () => void;
  onCreated: (booking: Booking) => void;
}

interface ServiceRow {
  id: string;
  name: string;
  description: string | null;
  price: number | string;
  duration_minutes: number;
}

interface BarberRow {
  id: string;
  username: string | null;
  display_name: string | null;
}

const toService = (row: ServiceRow): ServiceOption => ({
  id: row.id,
  name: row.name,
  description: row.description,
  price: Number(row.price),
  durationMinutes: row.duration_minutes,
});

const toBarber = (row: BarberRow): BarberOption => ({
  id: row.id,
  username: row.username,
  displayName: row.display_name,
});

const barberLabel = (barber: BarberOption): string => {
  const name = barber.displayName?.trim();
  const handle = barber.username ? `@${barber.username}` : null;
  if (name && handle) return `${name} (${handle})`;
  return name || handle || 'Trim barber';
};

const phonePattern = /^[+\d][\d\s().-]{6,23}$/;

/**
 * The customer booking form. Portalled to document.body rather than IonModal,
 * matching ConfirmModal: the dashboard sits inside IonContent and a portal
 * avoids the page's scroll container owning the dialog.
 */
const BookingModal: React.FC<BookingModalProps> = ({
  isOpen,
  onDismiss,
  onCreated,
}) => {
  const { session, profile } = useAuth();
  const titleId = useId();

  const [services, setServices] = useState<ServiceOption[]>([]);
  const [barbers, setBarbers] = useState<BarberOption[]>([]);
  const [isLoadingOptions, setIsLoadingOptions] = useState(true);
  const [optionsError, setOptionsError] = useState<string | null>(null);
  const [optionsVersion, setOptionsVersion] = useState(0);

  const [serviceId, setServiceId] = useState('');
  const [barberId, setBarberId] = useState('');
  const [date, setDate] = useState(defaultBookingDate());
  const [time, setTime] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const serviceRef = useRef<HTMLSelectElement | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const dismissRef = useRef(onDismiss);
  const submittingRef = useRef(isSubmitting);

  useEffect(() => {
    dismissRef.current = onDismiss;
  }, [onDismiss]);

  useEffect(() => {
    submittingRef.current = isSubmitting;
  }, [isSubmitting]);

  // Clear the form as the dialog closes, so reopening starts on a fresh visit
  // and the first paint is the loading state rather than last visit's options.
  useEffect(() => {
    if (isOpen) return;

    setServiceId('');
    setBarberId('');
    setDate(defaultBookingDate());
    setTime('');
    setPhone('');
    setNotes('');
    setError(null);
    setIsSubmitting(false);
    submittingRef.current = false;
    setServices([]);
    setBarbers([]);
    setOptionsError(null);
    setIsLoadingOptions(true);
  }, [isOpen]);

  // Load the menu each time the dialog opens. A retry bumps optionsVersion and
  // runs the same path without leaving the modal.
  useEffect(() => {
    if (!isOpen) return undefined;

    let cancelled = false;

    setIsLoadingOptions(true);
    setOptionsError(null);
    // The dialog may be reopened hours after it closed, so this is computed on
    // open, not kept from the previous visit.
    setDate(defaultBookingDate());

    const load = async () => {
      try {
        const [serviceResult, barberResult] = await Promise.all([
          supabase
            .from('services')
            .select('id, name, description, price, duration_minutes')
            .eq('is_active', true)
            .order('sort_order', { ascending: true })
            .order('name', { ascending: true }),
          supabase.rpc('list_barbers'),
        ]);

        if (cancelled) return;

        if (serviceResult.error || barberResult.error) {
          console.error(
            'Could not load booking options',
            serviceResult.error ?? barberResult.error,
          );
          setOptionsError(
            readBookingError(
              serviceResult.error ?? barberResult.error,
              'Could not load the booking form. Try again.',
            ),
          );
          setIsLoadingOptions(false);
          return;
        }

        const nextServices = ((serviceResult.data ?? []) as ServiceRow[]).map(
          toService,
        );
        const nextBarbers = ((barberResult.data ?? []) as BarberRow[]).map(
          toBarber,
        );

        setServices(nextServices);
        setBarbers(nextBarbers);
        setServiceId(nextServices[0]?.id ?? '');
        setBarberId(nextBarbers[0]?.id ?? '');

        const first = nextServices[0];
        if (first) {
          setDate((current) => {
            const fits = slotOptions(current, first.durationMinutes).some(
              (slot) => !isSlotPast(current, slot),
            );
            return fits ? current : defaultBookingDate(first.durationMinutes);
          });
        }

        setIsLoadingOptions(false);
      } catch (loadError) {
        if (cancelled) return;
        console.error('Could not load booking options', loadError);
        setOptionsError('Could not load the booking form. Try again.');
        setIsLoadingOptions(false);
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [isOpen, optionsVersion]);

  // Return focus to the button that opened the dialog.
  useEffect(() => {
    if (!isOpen) return undefined;
    const previous = document.activeElement;
    return () => {
      if (previous instanceof HTMLElement) previous.focus();
    };
  }, [isOpen]);

  // Move focus into the dialog. While the menu loads, the close button is the
  // only control; once the form renders, the service select is where a
  // customer starts. Without this, focus stayed on the button behind the
  // scrim and the first Tab walked the dashboard, not the form.
  useEffect(() => {
    if (!isOpen) return;
    const target =
      serviceRef.current ??
      cardRef.current?.querySelector<HTMLElement>(
        'button, input, select, textarea, [href]',
      );
    target?.focus();
  }, [isOpen, isLoadingOptions, services.length]);

  // Escape closes, body scroll locks. The refs keep this effect from
  // re-running whenever a keystroke changes the form or submitting state.
  useEffect(() => {
    if (!isOpen) return undefined;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !submittingRef.current) {
        dismissRef.current();
        return;
      }
      if (event.key !== 'Tab') return;

      // Keep tabbing inside the dialog. The dashboard behind it is still
      // mounted, so without this a screen reader or keyboard user can land on
      // a rail link that is visually covered by the scrim.
      const focusable = cardRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable || focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      // If focus was left behind on the page, Tab should enter the dialog
      // instead of continuing through the covered dashboard.
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

    document.addEventListener('keydown', onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  const service = useMemo(
    () => services.find((item) => item.id === serviceId) ?? null,
    [serviceId, services],
  );

  const slots = useMemo(
    () => (service ? slotOptions(date, service.durationMinutes) : []),
    [date, service],
  );

  const availableSlots = useMemo(
    () => slots.filter((slot) => !isSlotPast(date, slot)),
    [date, slots],
  );

  useEffect(() => {
    if (!time) return;
    if (!availableSlots.includes(time)) setTime('');
  }, [availableSlots, time]);

  if (!isOpen) return null;

  const dateIsClosed = isShopClosed(date);
  const timeHint = !date
    ? 'Choose a date first.'
    : dateIsClosed
      ? 'Trim is closed on Sundays.'
      : availableSlots.length === 0
        ? 'No times left on this date.'
        : null;

  const retry = () => setOptionsVersion((version) => version + 1);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submittingRef.current) return;
    setError(null);

    const trimmedPhone = phone.trim();
    const trimmedNotes = notes.trim();

    if (!service) {
      setError('Choose a service.');
      return;
    }
    if (!barberId) {
      setError('Choose a barber.');
      return;
    }
    if (!date) {
      setError('Choose a date.');
      return;
    }
    if (!time) {
      setError('Choose a time.');
      return;
    }
    if (dateIsClosed) {
      setError('Trim is closed on Sundays. Pick another day.');
      return;
    }
    if (!availableSlots.includes(time)) {
      setError('That time is no longer open. Pick another slot.');
      return;
    }
    if (!phonePattern.test(trimmedPhone)) {
      setError('Enter a phone number the barber can reach you on.');
      return;
    }
    if (trimmedNotes.length > 500) {
      setError('Keep the notes under 500 characters.');
      return;
    }

    setIsSubmitting(true);
    submittingRef.current = true;

    try {
      const { data, error: createError } = await supabase.rpc('create_booking', {
        p_barber_id: barberId,
        p_service_id: service.id,
        p_starts_at: toShopIso(date, time),
        p_customer_phone: trimmedPhone,
        p_notes: trimmedNotes || null,
      });

      if (createError) {
        console.error('Could not create booking', createError);
        setError(
          readBookingError(
            createError,
            'Could not create the appointment. Try again.',
          ),
        );
        return;
      }

      const row = Array.isArray(data) ? data[0] : data;
      if (!row) {
        setError('Could not create the appointment. Try again.');
        return;
      }

      onCreated(toBooking(row as BookingRow));
    } catch (cause) {
      console.error('Could not create booking', cause);
      setError(
        'Could not reach the booking service. Check your connection and try again.',
      );
    } finally {
      setIsSubmitting(false);
      submittingRef.current = false;
    }
  };

  const emptyOptions = services.length === 0 || barbers.length === 0;

  return createPortal(
    <div className="trim-book-modal">
      <div
        className="trim-book-modal__scrim"
        aria-hidden="true"
        onClick={() => {
          if (!isSubmitting) onDismiss();
        }}
      />

      <div
        ref={cardRef}
        className="trim-book-modal__card"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-busy={isSubmitting}
      >
        <header className="trim-book-modal__head">
          <div>
            <p className="trim-book-modal__eyebrow">New appointment</p>
            <h2 className="trim-book-modal__title" id={titleId}>
              Book a chair
            </h2>
            <p className="trim-book-modal__lede">
              Pick a service, barber and time. Your barber confirms the request
              from their dashboard.
            </p>
          </div>
          <button
            type="button"
            className="trim-book-modal__close"
            aria-label="Close booking form"
            disabled={isSubmitting}
            onClick={onDismiss}
          >
            <span aria-hidden="true">×</span>
          </button>
        </header>

        {isLoadingOptions ? (
          <p className="trim-book-form__loading" role="status">
            Loading the menu…
          </p>
        ) : optionsError ? (
          <div>
            <p className="trim-book-form__error" role="alert">
              {optionsError}
            </p>
            <div className="trim-book-form__actions">
              <button
                type="button"
                className="trim-book-form__cancel"
                onClick={onDismiss}
              >
                Close
              </button>
              <button
                type="button"
                className="trim-book-form__submit"
                onClick={retry}
              >
                Try again
              </button>
            </div>
          </div>
        ) : emptyOptions ? (
          <div>
            <p className="trim-book-form__error" role="alert">
              {services.length === 0
                ? 'The service menu is empty.'
                : 'No barbers are available yet.'}{' '}
              Try again in a moment.
            </p>
            <div className="trim-book-form__actions">
              <button
                type="button"
                className="trim-book-form__cancel"
                onClick={onDismiss}
              >
                Close
              </button>
              <button
                type="button"
                className="trim-book-form__submit"
                onClick={retry}
              >
                Try again
              </button>
            </div>
          </div>
        ) : (
          <form className="trim-book-form" onSubmit={submit} noValidate>
            <p className="trim-book-form__identity">
              Booking as{' '}
              {profile?.username
                ? `@${profile.username}`
                : (session?.user.email ?? 'your account')}
              {' · '}
              {SHOP.name}, {SHOP.address}
            </p>

            <div className="trim-book-form__grid">
              <label className="trim-book-field trim-book-field--wide">
                <span className="trim-book-field__label">Service</span>
                <select
                  ref={serviceRef}
                  value={serviceId}
                  disabled={isSubmitting}
                  required
                  onChange={(event) => setServiceId(event.target.value)}
                >
                  {services.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} — {formatMoney(item.price)} ·{' '}
                      {item.durationMinutes} min
                    </option>
                  ))}
                </select>
              </label>

              <label className="trim-book-field">
                <span className="trim-book-field__label">Barber</span>
                <select
                  value={barberId}
                  disabled={isSubmitting}
                  required
                  onChange={(event) => setBarberId(event.target.value)}
                >
                  {barbers.map((barber) => (
                    <option key={barber.id} value={barber.id}>
                      {barberLabel(barber)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="trim-book-field">
                <span className="trim-book-field__label">Date</span>
                <input
                  type="date"
                  value={date}
                  min={shopToday()}
                  max={maxBookingDate()}
                  disabled={isSubmitting}
                  required
                  onChange={(event) => setDate(event.target.value)}
                />
              </label>

              <label className="trim-book-field">
                <span className="trim-book-field__label">Time</span>
                <select
                  value={time}
                  disabled={
                    isSubmitting ||
                    !date ||
                    dateIsClosed ||
                    availableSlots.length === 0
                  }
                  required
                  onChange={(event) => setTime(event.target.value)}
                >
                  <option value="">Select a time</option>
                  {slots.map((slot) => (
                    <option
                      key={slot}
                      value={slot}
                      disabled={isSlotPast(date, slot)}
                    >
                      {slotLabel(slot)}
                    </option>
                  ))}
                </select>
                {timeHint ? (
                  <span className="trim-book-field__hint">{timeHint}</span>
                ) : null}
              </label>

              <label className="trim-book-field">
                <span className="trim-book-field__label">Phone</span>
                <input
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="+63 917 000 0000"
                  value={phone}
                  minLength={7}
                  maxLength={24}
                  disabled={isSubmitting}
                  required
                  onChange={(event) => setPhone(event.target.value)}
                />
              </label>

              <label className="trim-book-field trim-book-field--wide">
                <span className="trim-book-field__label">
                  Notes <span className="trim-book-field__optional">(optional)</span>
                </span>
                <textarea
                  rows={3}
                  maxLength={500}
                  placeholder="Fade on the sides, keep the length on top. Mention any reference here."
                  value={notes}
                  disabled={isSubmitting}
                  onChange={(event) => setNotes(event.target.value)}
                />
              </label>
            </div>

            {service ? (
              <p className="trim-book-form__summary">
                {service.name} · {formatMoney(service.price)} ·{' '}
                {service.durationMinutes} min
              </p>
            ) : null}

            <p className="trim-book-form__hint">
              {SHOP.name} · {SHOP.address} · Mon–Sat, 8:00 AM – 5:00 PM
            </p>

            {error ? (
              <p className="trim-book-form__error" role="alert">
                {error}
              </p>
            ) : null}

            <div className="trim-book-form__actions">
              <button
                type="button"
                className="trim-book-form__cancel"
                disabled={isSubmitting}
                onClick={onDismiss}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="trim-book-form__submit"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Requesting…' : 'Request appointment'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>,
    document.body,
  );
};

export default BookingModal;
