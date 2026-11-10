-- Barber feedback ratings.
--
-- A customer can rate a barber once per booking after the barber confirms or
-- completes it. The rating stays attached to the booking so the same
-- appointment cannot be rated twice, and list_barbers() exposes the aggregate
-- for the booking picker.

create table if not exists public.barber_ratings (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  customer_id uuid not null references public.profiles(id) on delete cascade,
  barber_id uuid not null references public.profiles(id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now(),
  constraint barber_ratings_booking_unique unique (booking_id),
  constraint barber_ratings_comment_length check (char_length(coalesce(comment, '')) <= 500)
);

create index if not exists barber_ratings_barber_idx
  on public.barber_ratings (barber_id, created_at desc);

create index if not exists barber_ratings_customer_idx
  on public.barber_ratings (customer_id, created_at desc);

alter table public.barber_ratings enable row level security;

-- Customers can read their own ratings and ratings for barbers are exposed in
-- aggregate through list_barbers(); direct reads are limited to the owner.
drop policy if exists "barber_ratings_select_own" on public.barber_ratings;
create policy "barber_ratings_select_own"
  on public.barber_ratings
  for select
  to authenticated
  using (customer_id = (select auth.uid()));

-- Writes go through submit_barber_rating() so booking ownership and status are
-- enforced on the server.
revoke all on table public.barber_ratings from anon, authenticated;

grant select on table public.barber_ratings to authenticated;

create or replace function public.submit_barber_rating(
  p_booking_id uuid,
  p_rating integer,
  p_comment text default null
)
returns public.barber_ratings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid := (select auth.uid());
  v_booking public.bookings%rowtype;
  v_comment text := nullif(trim(coalesce(p_comment, '')), '');
  v_row public.barber_ratings%rowtype;
begin
  if v_caller is null then
    raise exception 'Sign in to rate this appointment.' using errcode = '42501';
  end if;

  if p_rating is null or p_rating < 1 or p_rating > 5 then
    raise exception 'Choose a rating from 1 to 5.' using errcode = '22023';
  end if;

  if char_length(coalesce(v_comment, '')) > 500 then
    raise exception 'Keep feedback under 500 characters.' using errcode = '22023';
  end if;

  select *
  into v_booking
  from public.bookings
  where id = p_booking_id
  for update;

  if not found then
    raise exception 'Appointment not found.' using errcode = '22023';
  end if;

  if v_booking.customer_id is distinct from v_caller then
    raise exception 'You can only rate your own appointments.' using errcode = '42501';
  end if;

  if v_booking.status not in ('confirmed', 'completed') then
    raise exception 'You can rate this barber after the booking is confirmed.'
      using errcode = '22023';
  end if;

  if v_booking.barber_id is null then
    raise exception 'This appointment has no barber to rate.' using errcode = '22023';
  end if;

  insert into public.barber_ratings (booking_id, customer_id, barber_id, rating, comment)
  values (v_booking.id, v_caller, v_booking.barber_id, p_rating, v_comment)
  on conflict (booking_id) do nothing
  returning * into v_row;

  if v_row.id is null then
    raise exception 'This appointment has already been rated.' using errcode = '23505';
  end if;

  return v_row;
end;
$$;

revoke all on function public.submit_barber_rating(uuid, integer, text) from public;
grant execute on function public.submit_barber_rating(uuid, integer, text) to authenticated;

-- The booking form needs barber rating details. The return columns changed, so
-- the function is dropped and recreated rather than replaced in place.
drop function if exists public.list_barbers();

create function public.list_barbers()
returns table (
  id uuid,
  username text,
  display_name text,
  avatar_url text,
  is_available boolean,
  rating_average numeric,
  rating_count bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id,
    p.username,
    p.display_name,
    p.avatar_url,
    p.is_available,
    round(avg(r.rating)::numeric, 1) as rating_average,
    count(r.id) as rating_count
  from public.profiles p
  left join public.barber_ratings r on r.barber_id = p.id
  where p.role = 'barber'
  group by p.id, p.username, p.display_name, p.avatar_url, p.is_available
  order by p.is_available desc, coalesce(p.display_name, p.username, ''), p.id;
$$;

revoke all on function public.list_barbers() from public;
grant execute on function public.list_barbers() to authenticated;
