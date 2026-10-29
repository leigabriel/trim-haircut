import { useCallback, useEffect, useState } from 'react';

import { supabase } from '../../lib/supabase';
import { readBookingError } from './format';
import type {
  Booking,
  BookingRow,
  BookingsState,
  BookingStatus,
} from './types';
import { toBooking } from './types';

/**
 * One query, filtered by row-level security: a customer gets their own
 * bookings, a barber gets the ones assigned to their chair, an admin gets all.
 * The dashboards share one instance so switching sections does not refetch.
 */
export const useBookings = (): BookingsState => {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const { data, error: loadError } = await supabase
        .from('bookings')
        .select('*')
        .order('starts_at', { ascending: true });

      if (loadError) {
        console.error('Could not load bookings', loadError);
        setError(
          readBookingError(
            loadError,
            'Could not load appointments. Try again.',
          ),
        );
        return;
      }

      setBookings(((data ?? []) as BookingRow[]).map(toBooking));
    } catch (cause) {
      console.error('Could not load bookings', cause);
      setError('Could not load appointments. Check your connection and try again.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const setStatus = useCallback(
    async (id: string, status: BookingStatus) => {
      try {
        const { data, error: updateError } = await supabase
          .from('bookings')
          .update({ status })
          .eq('id', id)
          .select('*')
          .maybeSingle();

        if (updateError) {
          console.error('Could not update booking status', updateError);
          return {
            ok: false,
            error: readBookingError(
              updateError,
              'Could not change the status. Try again.',
            ),
          };
        }
        if (!data) {
          return { ok: false, error: 'That appointment is no longer available.' };
        }

        const next = toBooking(data as BookingRow);
        setBookings((current) =>
          current.map((booking) => (booking.id === id ? next : booking)),
        );
        return { ok: true };
      } catch (cause) {
        console.error('Could not update booking status', cause);
        return {
          ok: false,
          error:
            'Could not reach the booking service. Check your connection and try again.',
        };
      }
    },
    [],
  );

  return { bookings, isLoading, error, reload, setStatus };
};
