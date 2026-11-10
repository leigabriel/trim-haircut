-- Barber feedback details for detail views (booking picker, admin, barber).
-- Returns feedback messages and basic customer display name for a barber.

create or replace function public.get_barber_feedback(p_barber_id uuid)
returns table (
  id uuid,
  rating integer,
  comment text,
  created_at timestamptz,
  customer_name text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    r.id,
    r.rating,
    r.comment,
    r.created_at,
    coalesce(nullif(trim(p.display_name), ''), nullif(trim(p.username), ''), 'Customer') as customer_name
  from public.barber_ratings r
  join public.profiles p on p.id = r.customer_id
  where r.barber_id = p_barber_id
  order by r.created_at desc;
$$;

revoke all on function public.get_barber_feedback(uuid) from public;
grant execute on function public.get_barber_feedback(uuid) to authenticated;
