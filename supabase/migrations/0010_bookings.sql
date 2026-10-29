-- Bookings and the service menu.
--
-- A booking snapshots the customer, barber, service, price and duration onto
-- the row. That keeps an old appointment readable after a profile or price
-- changes, and lets the barber and admin lists render without reading another
-- user's profile across RLS.
--
-- Apply after 0008_staff_roles.sql: the policies call current_profile_role().
--
-- Inserts go only through create_booking(), which derives the price, duration
-- and names on the server. Status is the only column a client grant can write;
-- the policies decide which rows a customer, barber or admin may change.

create table if not exists public.services (
  id               text primary key,
  name             text not null,
  description      text,
  price            numeric(10, 2) not null check (price >= 0),
  duration_minutes integer not null check (duration_minutes between 5 and 480),
  is_active        boolean not null default true,
  sort_order       integer not null default 0
);

-- Seed prices. Edit these rows in the SQL editor when the shop menu changes;
-- re-running this migration does not overwrite an edited row.
insert into public.services (id, name, description, price, duration_minutes, sort_order)
values
  ('signature-cut', 'Signature cut', 'Consultation, cut and finish.', 480, 45, 10),
  ('skin-fade', 'Skin fade', 'Clipper fade blended to the skin.', 420, 40, 20),
  ('beard-sculpt', 'Beard sculpt', 'Shape, line-up and hot towel.', 280, 30, 30),
  ('cut-and-beard', 'Cut and beard', 'Signature cut with a beard sculpt.', 680, 60, 40),
  ('kids-cut', 'Kids cut', 'Ages 12 and under.', 320, 30, 50)
on conflict (id) do nothing;

alter table public.services enable row level security;

drop policy if exists "read active services" on public.services;
create policy "read active services"
  on public.services for select to authenticated
  using (is_active);

revoke all on public.services from anon;
revoke all on public.services from authenticated;
grant select on public.services to authenticated;

create table if not exists public.bookings (
  id               uuid primary key default gen_random_uuid(),
  customer_id      uuid not null references auth.users (id) on delete cascade,
  customer_name    text not null,
  customer_email   text,
  customer_phone   text not null
                   check (char_length(customer_phone) between 7 and 24),
  barber_id        uuid references auth.users (id) on delete set null,
  barber_name      text not null,
  shop             text not null,
  service_id       text references public.services (id) on delete set null,
  service_name     text not null,
  price            numeric(10, 2) not null check (price >= 0),
  duration_minutes integer not null
                   check (duration_minutes between 5 and 480),
  starts_at        timestamptz not null,
  notes            text check (notes is null or char_length(notes) <= 500),
  status           text not null default 'requested'
                   check (status in ('requested', 'confirmed', 'completed', 'cancelled')),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists bookings_customer_idx
  on public.bookings (customer_id, starts_at desc);
create index if not exists bookings_barber_idx
  on public.bookings (barber_id, starts_at);
create index if not exists bookings_status_idx
  on public.bookings (status, starts_at);

-- A cancelled slot is free again, so only open bookings reserve the start.
create unique index if not exists bookings_barber_slot_idx
  on public.bookings (barber_id, starts_at)
  where status in ('requested', 'confirmed');

alter table public.bookings enable row level security;

drop policy if exists "read own or staff bookings" on public.bookings;
create policy "read own or staff bookings"
  on public.bookings for select to authenticated
  using (
    customer_id = (select auth.uid())
    or (
      barber_id = (select auth.uid())
      and public.current_profile_role() = 'barber'
    )
    or public.current_profile_role() = 'admin'
  );

drop policy if exists "staff update booking status" on public.bookings;
create policy "staff update booking status"
  on public.bookings for update to authenticated
  using (
    (
      barber_id = (select auth.uid())
      and public.current_profile_role() = 'barber'
    )
    or public.current_profile_role() = 'admin'
  )
  with check (
    (
      barber_id = (select auth.uid())
      and public.current_profile_role() = 'barber'
    )
    or public.current_profile_role() = 'admin'
  );

drop policy if exists "customer cancel own booking" on public.bookings;
create policy "customer cancel own booking"
  on public.bookings for update to authenticated
  using (
    customer_id = (select auth.uid())
    and status in ('requested', 'confirmed')
  )
  with check (
    customer_id = (select auth.uid())
    and status = 'cancelled'
  );

-- The policies call current_profile_role(); 0008 revoked it from public and
-- never granted it back. It only ever returns the caller's own role.
grant execute on function public.current_profile_role() to authenticated;

revoke all on public.bookings from anon;
revoke all on public.bookings from authenticated;
grant select on public.bookings to authenticated;
-- Status is the only client-writable column; the policies above choose rows.
grant update (status) on public.bookings to authenticated;

create or replace function public.touch_booking_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists bookings_touch_updated_at on public.bookings;
create trigger bookings_touch_updated_at
  before update on public.bookings
  for each row execute function public.touch_booking_updated_at();

-- The booking form needs the barbers' names. Reading profiles directly is
-- limited to the caller's own row, so expose only the public columns.
create or replace function public.list_barbers()
returns table (
  id uuid,
  username text,
  display_name text
)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.username, p.display_name
  from public.profiles p
  where p.role = 'barber'
  order by coalesce(p.display_name, p.username, ''), p.id;
$$;

revoke all on function public.list_barbers() from public;
grant execute on function public.list_barbers() to authenticated;

-- The only insert path. Price, duration, names and the shop are derived here,
-- so a customer cannot choose what a cut costs or who the booking is for.
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
  v_customer       uuid := (select auth.uid());
  v_customer_name  text;
  v_customer_email text;
  v_barber_name    text;
  v_service        public.services;
  v_local          timestamp;
  v_end            timestamp;
  v_phone          text := btrim(coalesce(p_customer_phone, ''));
  v_notes          text := nullif(btrim(coalesce(p_notes, '')), '');
  v_booking        public.bookings;
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

  select coalesce(p.display_name, p.username, 'Trim customer'), u.email::text
  into v_customer_name, v_customer_email
  from public.profiles p
  join auth.users u on u.id = p.id
  where p.id = v_customer;

  insert into public.bookings (
    customer_id, customer_name, customer_email, customer_phone,
    barber_id, barber_name, shop,
    service_id, service_name, price, duration_minutes,
    starts_at, notes
  )
  values (
    v_customer,
    coalesce(v_customer_name, 'Trim customer'),
    v_customer_email,
    v_phone,
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

comment on table public.bookings is
  'Appointments. Created only by create_booking(); status is the only column a client grant can update.';
