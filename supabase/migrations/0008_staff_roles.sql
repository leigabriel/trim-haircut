-- Roles, and the two database functions the admin dashboard runs on.
--
-- Apply this in the Supabase SQL editor (or with the CLI) before opening
-- /admin or /barber. Until it lands the app still works: the profile read
-- falls back to the pre-role column set and every account behaves as a
-- customer.
--
-- Role is deliberately not writable by the account it belongs to. The existing
-- "update own profile" policy would otherwise let any customer promote
-- themselves by writing to their own row, so the table-wide update grant is
-- replaced with update rights on the editable columns only.

alter table public.profiles
  add column if not exists role text not null default 'customer';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_role_check'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_role_check
      check (role in ('customer', 'admin', 'barber'));
  end if;
end $$;

create index if not exists profiles_role_idx on public.profiles (role);

revoke update on public.profiles from authenticated;
revoke update on public.profiles from anon;

-- The app writes a username on its own row and nothing else at signup.
grant update (username, display_name, avatar_url) on public.profiles to authenticated;

-- An insert is how the username form fills a row the trigger may not have
-- created yet. Role is absent so it cannot be chosen here either.
revoke insert on public.profiles from authenticated;
grant insert (id, username, display_name, avatar_url) on public.profiles to authenticated;

-- The caller's own role. Security definer because the function reads profiles,
-- and a policy that called a plain function would recurse into RLS.
create or replace function public.current_profile_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = (select auth.uid());
$$;

-- Every account, for the admin manager. A plain select cannot answer this: the
-- profiles policy exposes only the caller's own row. The widening happens
-- inside the function, which re-checks the caller first.
create or replace function public.admin_list_accounts()
returns table (
  id uuid,
  username text,
  display_name text,
  email text,
  role text,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if public.current_profile_role() is distinct from 'admin' then
    raise exception 'Not authorised' using errcode = '42501';
  end if;

  return query
    select p.id, p.username, p.display_name, u.email::text, p.role, p.created_at
    from public.profiles p
    join auth.users u on u.id = p.id
    order by p.created_at desc;
end;
$$;

-- The only way to change a role. Refuses to demote the caller, so a lone admin
-- cannot lock the project out of its own dashboard.
create or replace function public.admin_set_role(p_user uuid, p_role text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid := (select auth.uid());
begin
  if public.current_profile_role() is distinct from 'admin' then
    raise exception 'Not authorised' using errcode = '42501';
  end if;

  if p_role not in ('customer', 'admin', 'barber') then
    raise exception 'Unknown role: %', p_role using errcode = '22023';
  end if;

  if p_user = v_caller and p_role <> 'admin' then
    raise exception 'You cannot remove your own admin role' using errcode = '42501';
  end if;

  update public.profiles set role = p_role where id = p_user;
end;
$$;

-- Functions in public are executable by every role by default. Narrow them to
-- authenticated callers; the inner role check still decides who gets data.
revoke all on function public.current_profile_role() from public;
revoke all on function public.admin_list_accounts() from public;
revoke all on function public.admin_set_role(uuid, text) from public;

grant execute on function public.admin_list_accounts() to authenticated;
grant execute on function public.admin_set_role(uuid, text) to authenticated;

comment on column public.profiles.role is
  'customer | admin | barber. Written only by admin_set_role, never by the account itself.';
