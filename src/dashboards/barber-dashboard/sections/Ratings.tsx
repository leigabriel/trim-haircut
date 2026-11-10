import { useEffect, useState } from 'react';

import { useAuth } from '../../../auth/AuthProvider';
import { supabase } from '../../../lib/supabase';
import BookingAvatar from '../../booking/BookingAvatar';
import { readBookingError } from '../../booking/format';
import SectionHead from '../../shell/SectionHead';
import '../../booking/booking.css';

interface FeedbackItem {
  id: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  customerName: string;
}

interface BarberSummary {
  ratingAverage: number | null;
  ratingCount: number;
}

const formatDate = (iso: string): string => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
};

const Ratings: React.FC = () => {
  const { profile, session } = useAuth();
  const barberId = profile?.id ?? session?.user.id ?? null;
  const barberName = profile?.displayName?.trim() || profile?.username || 'Trim barber';
  const [feedback, setFeedback] = useState<FeedbackItem[]>([]);
  const [summary, setSummary] = useState<BarberSummary>({ ratingAverage: null, ratingCount: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!barberId) {
      setIsLoading(false);
      return;
    }
    let active = true;
    setIsLoading(true);
    setError(null);

    void (async () => {
      try {
        const [feedbackResult, barbersResult] = await Promise.all([
          supabase.rpc('get_barber_feedback', { p_barber_id: barberId }),
          supabase.rpc('list_barbers'),
        ]);

        if (!active) return;

        if (feedbackResult.error) {
          console.error('Could not load barber ratings', feedbackResult.error);
          const err = feedbackResult.error as { code?: string; message?: string };
          const missingRpc =
            err.code === '42883' ||
            err.code === 'PGRST202' ||
            String(err.message ?? '').includes('get_barber_feedback');
          setError(
            missingRpc
              ? 'Ratings details are not available yet. Apply the latest Supabase migrations.'
              : readBookingError(feedbackResult.error, 'Could not load your ratings right now.'),
          );
          setFeedback([]);
        } else {
          const rows = (feedbackResult.data ?? []) as Array<{
            id: string;
            rating: number;
            comment: string | null;
            created_at: string;
            customer_name: string | null;
          }>;
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

        if (!barbersResult.error) {
          const me = ((barbersResult.data ?? []) as Array<{
            id: string;
            rating_average: number | string | null;
            rating_count: number | string | null;
          }>).find((row) => row.id === barberId);
          if (me) {
            setSummary({
              ratingAverage:
                me.rating_average === null || me.rating_average === undefined
                  ? null
                  : Number(me.rating_average),
              ratingCount: Number(me.rating_count ?? 0),
            });
          }
        }
      } catch (cause) {
        if (!active) return;
        console.error('Could not load barber ratings', cause);
        setError('Could not load your ratings right now.');
      } finally {
        if (active) setIsLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [barberId]);

  const summaryText =
    summary.ratingCount > 0 && summary.ratingAverage !== null
      ? `★ ${summary.ratingAverage.toFixed(1)} average · ${summary.ratingCount} rating${summary.ratingCount === 1 ? '' : 's'}`
      : 'No ratings yet';

  return (
    <>
      <SectionHead
        title="Ratings"
        lede="Customer feedback and ratings for your chair after confirmed or completed bookings."
      />

      <section className="trim-card">
        <div className="trim-barber-modal__customer">
          <BookingAvatar src={profile?.avatarUrl} name={barberName} className="trim-book-avatar--lg" />
          <div className="trim-barber-modal__identity">
            <p className="trim-barber-modal__name">{barberName}</p>
            <p className="trim-barber-modal__meta">{summaryText}</p>
            <p className="trim-barber-modal__meta">
              {profile?.isAvailable === false ? 'Not available for bookings' : 'Available for bookings'}
            </p>
          </div>
        </div>
      </section>

      <section className="trim-card">
        <h2 className="trim-card__title">Feedback messages</h2>
        {isLoading ? (
          <p className="trim-card__text">Loading feedback…</p>
        ) : error ? (
          <p className="trim-book-form__error" role="alert">{error}</p>
        ) : feedback.length === 0 ? (
          <p className="trim-card__text">No feedback messages yet. Ratings from customers will appear here after confirmed bookings.</p>
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
    </>
  );
};

export default Ratings;
