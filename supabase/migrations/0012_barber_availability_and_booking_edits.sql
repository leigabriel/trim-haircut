-- Barber availability, customer profile snapshots and customer booking edits.
--
-- Apply after 0010_bookings.sql. Adds:
--   * profiles.is_available, toggled by a barber from their dashboard
--   * bookings.customer_avatar_url, snapshotted like the other customer columns
--   * list_barbers() with the avatar and availability the booking form shows
--   * update_booking() and delete_booking(), both customer-only
--   * the reduced service menu prices
--
-- The booking form still cannot write the table directly: price, duration and
-- names are derived on the server, and the policies decide which rows may
-- change.

-- Barber availability -------------------------------------------------------

alter table public.profiles
  add column if not exists is_available boolean not null default true;

comment on column public.profiles.is_available is
  'Barber chair availability. Shown to customers when they choose a barber.';

-- Toggling availability stays a security-definer function rather than a
-- column grant, so the check is the barber role rather than owning any row.
create or replace function public.set_barber_availability(p_available boolean)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid := (select auth.uid());
begin
  if v_caller is null then
    raise exception 'Sign in to change availability.' using errcode = '42501';
  end if;

  if public.current_profile_role() is distinct from 'barber' then
    raise exception 'Only barber accounts can change availability.'
      using errcode = '42501';
  end if;

  update public.profiles
  set is_available = p_available
  where id = v_caller;

  return p_available;
end;
$$;

revoke all on function public.set_barber_availability(boolean) from public;
grant execute on function public.set_barber_availability(boolean) to authenticated;

-- The booking form needs the barber's avatar and availability. The return
-- columns changed, so the function is dropped and recreated rather than
-- replaced in place.
drop function if exists public.list_barbers();

create function public.list_barbers()
returns table (
  id uuid,
  username text,
  display_name text,
  avatar_url text,
  is_available boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.username, p.display_name, p.avatar_url, p.is_available
  from public.profiles p
  where p.role = 'barber'
  order by p.is_available desc, coalesce(p.display_name, p.username, ''), p.id;
$$;

revoke all on function public.list_barbers() from public;
grant execute on function public.list_barbers() to authenticated;

-- Customer avatar snapshot ------------------------------------------------

alter table public.bookings
  add column if not exists customer_avatar_url text;

comment on column public.bookings.customer_avatar_url is
  'Avatar snapshot at request time, so a barber can render the customer card without reading another profile across RLS.';

-- Fill existing rows once. New bookings snapshot the avatar in create_booking.
-- The updated_at trigger is paused for this backfill: the avatar is a display
-- snapshot, not an appointment change, and moving every row to "just updated"
-- would flood the barber's recent activity list.
alter table public.bookings disable trigger bookings_touch_updated_at;

update public.bookings b
set customer_avatar_url = p.avatar_url
from public.profiles p
where p.id = b.customer_id
  and b.customer_avatar_url is null;

alter table public.bookings enable trigger bookings_touch_updated_at;

-- create_booking(): add the avatar snapshot -------------------------------

create or replace function public.create_booking(
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
  v_customer        uuid := (select auth.uid());
  v_customer_name   text;
  v_customer_email  text;
  v_customer_avatar text;
  v_barber_name     text;
  v_service         public.services;
  v_local           timestamp;
  v_end             timestamp;
  v_phone           text := btrim(coalesce(p_customer_phone, ''));
  v_notes           text := nullif(btrim(coalesce(p_notes, '')), '');
  v_booking         public.bookings;
begin
  if v_customer is null then
    raise exception 'Sign in to book an appointment.' using errcode = '42501';
  end if;

  if char_length(v_phone) < 7 or char_length(v_phone) > 24 then
    raise exception 'Enter a phone number the barber can reach you on.'
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

  -- Serialise overlapping requests for the same chair. The partial unique
  -- index catches the same start; this lock makes the range check safe for
  -- two requests a few minutes apart.
  perform pg_advisory_xact_lock(
    hashtext('trim-booking:' || p_barber_id::text)::bigint
  );

  if exists (
    select 1
    from public.bookings b
    where b.barber_id = p_barber_id
      and b.status in ('requested', 'confirmed')
      and p_starts_at < b.starts_at + make_interval(mins => b.duration_minutes)
      and b.starts_at < p_starts_at + make_interval(mins => v_service.duration_minutes)
  ) then
    raise exception 'That slot is already booked. Pick another time.'
      using errcode = '23P01';
  end if;

  select
    coalesce(p.display_name, p.username, 'Trim customer'),
    u.email::text,
    p.avatar_url
  into v_customer_name, v_customer_email, v_customer_avatar
  from public.profiles p
  join auth.users u on u.id = p.id
  where p.id = v_customer;

  insert into public.bookings (
    customer_id, customer_name, customer_email, customer_phone,
    customer_avatar_url,
    barber_id, barber_name, shop,
    service_id, service_name, price, duration_minutes,
    starts_at, notes
  )
  values (
    v_customer,
    coalesce(v_customer_name, 'Trim customer'),
    v_customer_email,
    v_phone,
    v_customer_avatar,
    p_barber_id,
    v_barber_name,
    'Trim - Naujan, Oriental Mindoro',
    v_service.id,
    v_service.name,
    v_service.price,
    v_service.duration_minutes,
    p_starts_at,
    v_notes
  )
  returning * into v_booking;

  return v_booking;
end;
$$;

revoke all on function public.create_booking(uuid, text, timestamptz, text, text) from public;
grant execute on function public.create_booking(uuid, text, timestamptz, text, text) to authenticated;

-- update_booking(): customer edits an open appointment ---------------------
--
-- Re-derives the price, duration and names so an edited booking is priced from
-- the menu, not from anything the browser sends. The slot checks are the same
-- as create_booking(), with the edited row excluded from the overlap test.

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
  v_phone       text := btrim(coalesce(p_customer_phone, ''));
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

  if char_length(v_phone) < 7 or char_length(v_phone) > 24 then
    raise exception 'Enter a phone number the barber can reach you on.'
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

  return v_booking;
end;
$$;

revoke all on function public.update_booking(uuid, uuid, text, timestamptz, text, text) from public;
grant execute on function public.update_booking(uuid, uuid, text, timestamptz, text, text) to authenticated;

-- delete_booking(): customer removes their own appointment -----------------

create or replace function public.delete_booking(p_booking_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer uuid := (select auth.uid());
  v_deleted  integer;
begin
  if v_customer is null then
    raise exception 'Sign in to delete an appointment.' using errcode = '42501';
  end if;

  delete from public.bookings
  where id = p_booking_id
    and customer_id = v_customer;

  get diagnostics v_deleted = row_count;

  if v_deleted = 0 then
    raise exception 'That appointment no longer exists.' using errcode = 'P0001';
  end if;

  return true;
end;
$$;

revoke all on function public.delete_booking(uuid) from public;
grant execute on function public.delete_booking(uuid) to authenticated;

-- Menu prices --------------------------------------------------------------
--
-- The customer-facing menu now runs from P100 to P200. Existing bookings keep
-- the price they were made at; only new and edited bookings snapshot these.

update public.services
set price = v.price
from (
  values
    ('signature-cut', 180::numeric),
    ('skin-fade', 150::numeric),
    ('beard-sculpt', 120::numeric),
    ('cut-and-beard', 200::numeric),
    ('kids-cut', 100::numeric)
) as v(id, price)
where public.services.id = v.id;

comment on table public.bookings is
  'Appointments. Created only by create_booking(); edited by update_booking(); deleted by delete_booking(); status is the only column a client grant can update directly.';
