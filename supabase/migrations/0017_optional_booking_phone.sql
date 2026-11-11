-- Make booking phone number optional.
--
-- Apply after 0016_barber_busy_slots.sql (and 0012/0010 which define bookings
-- and create/update_booking). Customers may omit a phone number; when provided
-- it is still validated for a reasonable length.

alter table public.bookings
  alter column customer_phone drop not null;

alter table public.bookings
  drop constraint if exists bookings_customer_phone_check;

alter table public.bookings
  add constraint bookings_customer_phone_check
  check (
    customer_phone is null
    or char_length(btrim(customer_phone)) between 7 and 24
  );

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
  v_phone           text := nullif(btrim(coalesce(p_customer_phone, '')), '');
  v_notes           text := nullif(btrim(coalesce(p_notes, '')), '');
  v_booking         public.bookings;
begin
  if v_customer is null then
    raise exception 'Sign in to book an appointment.' using errcode = '42501';
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

  return v_booking;
end;
$$;

revoke all on function public.update_booking(uuid, uuid, text, timestamptz, text, text) from public;
grant execute on function public.update_booking(uuid, uuid, text, timestamptz, text, text) to authenticated;
