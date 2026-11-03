-- Avatar for the admin account manager.
--
-- admin_list_accounts() returns every account for /admin. The User and Barber
-- manager tables show the avatar beside the name, so the function has to expose
-- avatar_url as well. "create or replace" cannot change a function's OUT
-- columns, so the old signature is dropped first; the grants that drop removes
-- are restored at the end.
--
-- Apply after 0008_staff_roles.sql. Safe to run more than once.

drop function if exists public.admin_list_accounts();

create function public.admin_list_accounts()
returns table (
  id uuid,
  username text,
  display_name text,
  avatar_url text,
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
    select
      p.id,
      p.username,
      p.display_name,
      p.avatar_url,
      u.email::text,
      p.role,
      p.created_at
    from public.profiles p
    join auth.users u on u.id = p.id
    order by p.created_at desc;
end;
$$;

revoke all on function public.admin_list_accounts() from public;
grant execute on function public.admin_list_accounts() to authenticated;

-- PostgREST caches function signatures. Ask it to reload so the new avatar_url
-- column is visible without waiting for the next scheduled refresh.
notify pgrst, 'reload schema';
