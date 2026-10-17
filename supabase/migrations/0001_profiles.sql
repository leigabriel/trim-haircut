create table public.profiles (
  id           uuid primary key references auth.users on delete cascade,
  username     text unique
               check (username ~ '^[a-z0-9_]{3,24}$'),
  display_name text,
  avatar_url   text,
  face_shape   text check (face_shape in ('oval','round','square','heart','oblong')),
  created_at   timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "read own profile"
  on public.profiles for select
  using ((select auth.uid()) = id);

create policy "update own profile"
  on public.profiles for update
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

create policy "insert own profile"
  on public.profiles for insert
  with check ((select auth.uid()) = id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    coalesce(
      new.raw_user_meta_data ->> 'avatar_url',
      new.raw_user_meta_data ->> 'picture'
    )
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();