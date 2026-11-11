import { useCallback, useEffect, useState } from 'react';

import { supabase } from '../../lib/supabase';

export interface BookingEventRow {
  id: string;
  booking_id: string;
  barber_id: string | null;
  customer_id: string | null;
  customer_name: string;
  service_name: string;
  starts_at: string;
  event_type: 'updated' | 'deleted';
  actor_id: string | null;
  created_at: string;
}

export interface BookingEvent {
  id: string;
  bookingId: string;
  barberId: string | null;
  customerId: string | null;
  customerName: string;
  serviceName: string;
  startsAt: string;
  eventType: 'updated' | 'deleted';
  actorId: string | null;
  createdAt: string;
}

const toEvent = (row: BookingEventRow): BookingEvent => ({
  id: row.id,
  bookingId: row.booking_id,
  barberId: row.barber_id,
  customerId: row.customer_id,
  customerName: row.customer_name,
  serviceName: row.service_name,
  startsAt: row.starts_at,
  eventType: row.event_type,
  actorId: row.actor_id,
  createdAt: row.created_at,
});

export interface BookingEventsState {
  events: BookingEvent[];
  isLoading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

export const useBookingEvents = (): BookingEventsState => {
  const [events, setEvents] = useState<BookingEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const { data, error: loadError } = await supabase
        .from('booking_events')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (loadError) {
        console.error('Could not load booking events', loadError);
        setError('Could not load booking activity.');
        return;
      }

      setEvents(((data ?? []) as BookingEventRow[]).map(toEvent));
    } catch (cause) {
      console.error('Could not load booking events', cause);
      setError('Could not load booking activity.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { events, isLoading, error, reload };
};
