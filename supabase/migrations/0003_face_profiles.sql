-- Face shape reading.
--
-- One row per customer rather than a history: re-scanning or re-picking a
-- shape overwrites. The primary key on user_id makes that an upsert from the
-- client with no extra read.
--
-- source and the nullable measurements are the point of the split. A scan
-- produces confidence and ratios; a shape the customer set themselves produces
-- neither. Storing them separately lets the UI say "92% confidence" only when
-- something was actually measured.

create table if not exists public.face_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  shape text not null check (shape in (
    'oval', 'round', 'square', 'heart', 'diamond', 'long', 'triangle'
  )),
  source text not null check (source in ('manual', 'scanned')),
  confidence real check (confidence is null or (confidence >= 0 and confidence <= 100)),
  forehead_ratio real,
  jaw_ratio real,
  length_ratio real,
  measured_at timestamptz not null default now(),
  -- A manual pick has nothing measured, so it must not carry numbers that
  -- would render as though it had.
  constraint manual_has_no_measurements check (
    source = 'scanned' or (
      confidence is null
      and forehead_ratio is null
      and jaw_ratio is null
      and length_ratio is null
    )
  )
);

alter table public.face_profiles enable row level security;

-- Customers read and write their own reading, and nothing else. The client
-- upserts directly, so an insert and an update policy are both required.
create policy "read own face profile"
  on public.face_profiles
  for select
  using (auth.uid() = user_id);

create policy "insert own face profile"
  on public.face_profiles
  for insert
  with check (auth.uid() = user_id);

create policy "update own face profile"
  on public.face_profiles
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

comment on table public.face_profiles is
  'The customer''s current face shape. Derived ratios are null when set by hand.';