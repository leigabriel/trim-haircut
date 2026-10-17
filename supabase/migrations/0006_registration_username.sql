-- Let the signup form set the username at registration time.
--
-- handle_new_user only ever read display_name and avatar_url from Google's
-- OAuth metadata, so username stayed null and the Welcome page collected it
-- afterwards. Email registration supplies a username up front, in
-- user_metadata, so the trigger has to read it.
--
-- Google sign-in is untouched: it sends no username, this falls back to null,
-- and the existing Welcome flow still handles it. That is the difference
-- between a new account created by this and a returning one.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, username, display_name, avatar_url)
  values (
    new.id,
    -- Null when absent, which is the Google case. The unique constraint on
    -- profiles.username is the final authority on availability: if it is taken,
    -- this insert raises and the signup is rejected rather than silently
    -- creating a profile with someone else's name.
    nullif(lower(trim(new.raw_user_meta_data ->> 'username')), ''),
    coalesce(
      new.raw_user_meta_data ->> 'display_name',
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name'
    ),
    coalesce(
      new.raw_user_meta_data ->> 'avatar_url',
      new.raw_user_meta_data ->> 'picture'
    )
  );
  return new;
end;
$$;