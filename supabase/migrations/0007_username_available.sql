-- Availability check for the Welcome page.
--
-- The profiles RLS policy only exposes the caller's own row, so a plain select
-- from the app can never see whether somebody else already owns a name: every
-- candidate looked free, and the rejection only arrived from the unique
-- constraint when the row was saved. This security-definer function answers the
-- question without returning any row, so it leaks nothing beyond "in use",
-- which is exactly what the form has to tell the customer anyway.
--
-- The profiles.username check constraint stays the broader a-z0-9_ pattern.
-- Narrowing it would fail on any existing row that already contains a digit or
-- underscore, and the app only ever sends lowercase letters now.
--
-- If this function is not applied, the app treats availability as unknown and
-- falls back to the unique constraint on save; nothing breaks, the live
-- "taken / available" line simply stays silent.

create or replace function public.username_available(candidate text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select not exists (
    select 1
    from public.profiles
    where username = lower(btrim(candidate))
  );
$$;

revoke all on function public.username_available(text) from public;
grant execute on function public.username_available(text) to authenticated;
