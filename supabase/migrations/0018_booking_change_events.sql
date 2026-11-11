-- Record customer booking edits/deletes so barber and admin can be notified.
--
-- Apply after 0017_optional_booking_phone.sql.
-- Notifications in the app are derived from live records; deleted bookings no
-- longer exist as rows, so deletions (and updates) are recorded here.

create table if not exists public.booking_events (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null,
  barber_id uuid references auth.users (id) on delete set null,
  customer_id uuid references auth.users (id) on delete set null,
  customer_name text not null,
  service_name text not null,
  starts_at timestamptz not null,
  event_type text not null check (event_type in ('updated', 'deleted')),
  actor_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists booking_events_barber_idx
  on public.booking_events (barber_id, created_at desc);
create index if not exists booking_events_created_idx
  on public.booking_events (created_at desc);

alter table public.booking_events enable row level security;

drop policy if exists "barber read own booking events" on public.booking_events;
create policy "barber read own booking events"
  on public.booking_events for select to authenticated
  using (
    barber_id = (select auth.uid())
    and public.current_profile_role() = 'barber'
  );

drop policy if exists "admin read booking events" on public.booking_events;
create policy "admin read booking events"
  on public.booking_events for select to authenticated
  using (public.current_profile_role() = 'admin');

revoke all on public.booking_events from anon;
revoke all on public.booking_events from authenticated;
grant select on public.booking_events to authenticated;

-- update_booking(): log when a customer edits their appointment -------------
create or replace function public.update_booking(
  p_booking_id uuid,
  p_barber_id uuid,
  p_service_id text,
  p_starts_at timestamptz,
  p_customer_phone text,
  p_notes text default null
)
returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer    uuid := (select auth.uid());
  v_booking     public.bookings;
  v_barber_name text;
  v_service     public.services;
  v_local       timestamp;
  v_end         timestamp;
  v_phone       text := nullif(btrim(coalesce(p_customer_phone, '')), '');
  v_notes       text := nullif(btrim(coalesce(p_notes, '')), '');
begin
  if v_customer is null then
    raise exception 'Sign in to edit an appointment.' using errcode = '42501';
  end if;

  select * into v_booking
  from public.bookings
  where id = p_booking_id;

  if not found then
    raise exception 'That appointment no longer exists.' using errcode = 'P0001';
  end if;

  if v_booking.customer_id <> v_customer then
    raise exception 'You can only edit your own appointment.' using errcode = '42501';
  end if;

  if v_booking.status not in ('requested', 'confirmed') then
    raise exception 'Only a requested or confirmed appointment can be edited.'
      using errcode = '22023';
  end if;

  if v_booking.starts_at <= now() then
    raise exception 'That appointment has already started.' using errcode = '22023';
  end if;

  if v_phone is not null and (char_length(v_phone) < 7 or char_length(v_phone) > 24) then
    raise exception 'Enter a valid phone number, or leave it blank.'
      using errcode = '22023';
  end if;

  if v_notes is not null and char_length(v_notes) > 500 then
    raise exception 'Keep the notes under 500 characters.' using errcode = '22023';
  end if;

  select * into v_service
  from public.services
  where id = p_service_id and is_active;

  if not found then
    raise exception 'That service is not available.' using errcode = '22023';
  end if;

  select coalesce(p.display_name, p.username, 'Trim barber')
  into v_barber_name
  from public.profiles p
  where p.id = p_barber_id and p.role = 'barber';

  if not found then
    raise exception 'That barber is not available.' using errcode = '22023';
  end if;

  if p_starts_at <= now() then
    raise exception 'Pick a time in the future.' using errcode = '22023';
  end if;

  if p_starts_at > now() + interval '90 days' then
    raise exception 'Bookings open 90 days ahead.' using errcode = '22023';
  end if;

  v_local := p_starts_at at time zone 'Asia/Manila';

  if extract(isodow from v_local) = 7 then
    raise exception 'Trim is closed on Sundays.' using errcode = '22023';
  end if;

  if v_local::time < time '08:00' then
    raise exception 'The first appointment is at 8:00 AM.' using errcode = '22023';
  end if;

  v_end := v_local + make_interval(mins => v_service.duration_minutes);

  if v_end::date <> v_local::date or v_end::time > time '17:00' then
    raise exception 'That service does not fit before closing at 5:00 PM.'
      using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(
    hashtext('trim-booking:' || p_barber_id::text)::bigint
  );

  if exists (
    select 1
    from public.bookings b
    where b.barber_id = p_barber_id
      and b.id <> p_booking_id
      and b.status in ('requested', 'confirmed')
      and p_starts_at < b.starts_at + make_interval(mins => b.duration_minutes)
      and b.starts_at < p_starts_at + make_interval(mins => v_service.duration_minutes)
  ) then
    raise exception 'That slot is already booked. Pick another time.'
      using errcode = '23P01';
  end if;

  update public.bookings
  set
    barber_id = p_barber_id,
    barber_name = v_barber_name,
    service_id = v_service.id,
    service_name = v_service.name,
    price = v_service.price,
    duration_minutes = v_service.duration_minutes,
    starts_at = p_starts_at,
    customer_phone = v_phone,
    notes = v_notes
  where id = p_booking_id
  returning * into v_booking;

  insert into public.booking_events (
    booking_id, barber_id, customer_id, customer_name, service_name, starts_at, event_type, actor_id
  ) values (
    v_booking.id,
    v_booking.barber_id,
    v_booking.customer_id,
    v_booking.customer_name,
    v_booking.service_name,
    v_booking.starts_at,
    'updated',
    v_customer
  );

  return v_booking;
end;
$$;

revoke all on function public.update_booking(uuid, uuid, text, timestamptz, text, text) from public;
grant execute on function public.update_booking(uuid, uuid, text, timestamptz, text, text) to authenticated;

-- delete_booking(): log snapshot before customer deletes -------------------
create or replace function public.delete_booking(p_booking_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer uuid := (select auth.uid());
  v_booking  public.bookings;
begin
  if v_customer is null then
    raise exception 'Sign in to delete an appointment.' using errcode = '42501';
  end if;

  select * into v_booking
  from public.bookings
  where id = p_booking_id
    and customer_id = v_customer;

  if not found then
    raise exception 'That appointment no longer exists.' using errcode = 'P0001';
  end if;

  insert into public.booking_events (
    booking_id, barber_id, customer_id, customer_name, service_name, starts_at, event_type, actor_id
  ) values (
    v_booking.id,
    v_booking.barber_id,
    v_booking.customer_id,
    v_booking.customer_name,
    v_booking.service_name,
    v_booking.starts_at,
    'deleted',
    v_customer
  );

  delete from public.bookings
  where id = p_booking_id
    and customer_id = v_customer;

  return true;
end;
$$;

revoke all on function public.delete_booking(uuid) from public;
grant execute on function public.delete_booking(uuid) to authenticated;
