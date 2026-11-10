import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { supabase } from '../../lib/supabase';
import BookingAvatar from './BookingAvatar';
import { barberLabel } from './types';
import type { BarberOption } from './types';
import './booking.css';

interface BarberDetailsModalProps {
  barber: Partial<Pick<BarberOption, 'id' | 'username' | 'displayName' | 'avatarUrl' | 'isAvailable' | 'ratingAverage' | 'ratingCount'>> & { id: string } | null;
  onDismiss: () => void;
}

interface FeedbackRow {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  customer_name: string | null;
}

interface FeedbackItem {
  id: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  customerName: string;
}

const formatDate = (iso: string): string => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
};

const BarberDetailsModal: React.FC<BarberDetailsModalProps> = ({ barber, onDismiss }) => {
  const titleId = useId();
  const cardRef = useRef<HTMLDivElement | null>(null);
  const dismissRef = useRef(onDismiss);
  const [feedback, setFeedback] = useState<FeedbackItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [details, setDetails] = useState<BarberOption | null>(null);

  useEffect(() => {
    dismissRef.current = onDismiss;
  }, [onDismiss]);

  useEffect(() => {
    if (!barber) return;
    let active = true;
    setIsLoading(true);
    setError(null);
    setDetails(null);

    void (async () => {
      try {
        const needsSummary =
          barber.ratingAverage === undefined ||
          barber.ratingCount === undefined ||
          barber.isAvailable === undefined ||
          (barber.displayName === undefined && barber.username === undefined);

        const [feedbackResult, summaryResult] = await Promise.all([
          supabase.rpc('get_barber_feedback', { p_barber_id: barber.id }),
          needsSummary ? supabase.rpc('list_barbers') : Promise.resolve({ data: null, error: null }),
        ]);

        if (!active) return;

        if (feedbackResult.error) {
          console.error('Could not load barber feedback', feedbackResult.error);
          setError('Could not load feedback right now.');
          setFeedback([]);
        } else {
          const rows = (feedbackResult.data ?? []) as FeedbackRow[];
          setFeedback(
            rows.map((row) => ({
              id: row.id,
              rating: Number(row.rating),
              comment: row.comment,
              createdAt: row.created_at,
              customerName: row.customer_name?.trim() || 'Customer',
            })),
          );
        }

        if (needsSummary && !summaryResult.error) {
          const match = ((summaryResult.data ?? []) as Array<{
            id: string;
            username: string | null;
            display_name: string | null;
            avatar_url: string | null;
            is_available: boolean | null;
            rating_average: number | string | null;
            rating_count: number | string | null;
          }>).find((row) => row.id === barber.id);
          if (match) {
            setDetails({
              id: match.id,
              username: match.username,
              displayName: match.display_name,
              avatarUrl: match.avatar_url,
              isAvailable: match.is_available !== false,
              ratingAverage:
                match.rating_average === null || match.rating_average === undefined
                  ? null
                  : Number(match.rating_average),
              ratingCount: Number(match.rating_count ?? 0),
            });
          }
        }
      } catch (cause) {
        if (!active) return;
        console.error('Could not load barber details', cause);
        setError('Could not load feedback right now.');
        setFeedback([]);
      } finally {
        if (active) setIsLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [barber]);

  useEffect(() => {
    if (!barber) return undefined;
    const previous = document.activeElement as HTMLElement | null;
    cardRef.current?.querySelector<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
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

    document.addEventListener('keydown', onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      previous?.focus();
    };
  }, [barber]);

  if (!barber) return null;

  const view = {
    id: barber.id,
    username: barber.username ?? details?.username ?? null,
    displayName: barber.displayName ?? details?.displayName ?? null,
    avatarUrl: barber.avatarUrl ?? details?.avatarUrl ?? null,
    isAvailable: barber.isAvailable ?? details?.isAvailable ?? true,
    ratingAverage:
      barber.ratingAverage !== undefined ? barber.ratingAverage : (details?.ratingAverage ?? null),
    ratingCount:
      barber.ratingCount !== undefined ? barber.ratingCount : (details?.ratingCount ?? 0),
  };
  const name = barberLabel(view);
  const summary =
    view.ratingCount > 0 && view.ratingAverage !== null
      ? `★ ${view.ratingAverage.toFixed(1)} · ${view.ratingCount} rating${view.ratingCount === 1 ? '' : 's'}`
      : 'No ratings yet';

  return createPortal(
    <div className="trim-book-modal">
      <div className="trim-book-modal__scrim" aria-hidden="true" onClick={onDismiss} />
      <div
        ref={cardRef}
        className="trim-book-modal__card"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <header className="trim-book-modal__head">
          <div>
            <p className="trim-book-modal__eyebrow">Barber details</p>
            <h2 className="trim-book-modal__title" id={titleId}>
              {name}
            </h2>
            <p className="trim-book-modal__lede">{summary}</p>
          </div>
          <button
            type="button"
            className="trim-book-modal__close"
            aria-label="Close barber details"
            onClick={onDismiss}
          >
            <span aria-hidden="true">×</span>
          </button>
        </header>

        <div className="trim-barber-modal__customer">
          <BookingAvatar src={view.avatarUrl} name={name} className="trim-book-avatar--lg" />
          <div className="trim-barber-modal__identity">
            <p className="trim-barber-modal__name">{name}</p>
            <p className="trim-barber-modal__meta">
              {view.isAvailable ? 'Available for bookings' : 'Not available right now'}
            </p>
            <p className="trim-barber-modal__meta">{summary}</p>
          </div>
        </div>

        <section className="trim-barber-modal__notes">
          <h3 className="trim-barber-modal__subhead">Feedback & ratings</h3>
          {isLoading ? (
            <p>Loading feedback…</p>
          ) : error ? (
            <p className="trim-book-form__error" role="alert">{error}</p>
          ) : feedback.length === 0 ? (
            <p>No feedback messages yet.</p>
          ) : (
            <ul className="trim-barber-feedback">
              {feedback.map((item) => (
                <li key={item.id} className="trim-barber-feedback__item">
                  <p className="trim-barber-feedback__meta">
                    <strong>{item.customerName}</strong> · {'★'.repeat(item.rating)} ({item.rating}/5) · {formatDate(item.createdAt)}
                  </p>
                  {item.comment ? <p className="trim-barber-feedback__comment">{item.comment}</p> : null}
                </li>
              ))}
            </ul>
          )}
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

export default BarberDetailsModal;
