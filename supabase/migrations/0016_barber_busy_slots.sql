-- Expose booked time ranges for a barber on a given shop date so the booking
-- form can hide unavailable slots without revealing other customers' details.

create or replace function public.list_barber_busy_slots(
  p_barber_id uuid,
  p_date date,
  p_exclude_booking_id uuid default null
)
returns table (
  starts_at timestamptz,
  duration_minutes integer
)
language sql
stable
security definer
set search_path = public
as $$
  select b.starts_at, b.duration_minutes
  from public.bookings b
  where b.barber_id = p_barber_id
    and b.status in ('requested', 'confirmed')
    and (p_exclude_booking_id is null or b.id <> p_exclude_booking_id)
    and (b.starts_at at time zone 'Asia/Manila')::date = p_date;
$$;

revoke all on function public.list_barber_busy_slots(uuid, date, uuid) from public;
grant execute on function public.list_barber_busy_slots(uuid, date, uuid) to authenticated;
