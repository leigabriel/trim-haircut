-- Additional barbershop services for the booking menu.
-- Safe to re-run: existing service rows are not overwritten.

insert into public.services (id, name, description, price, duration_minutes, is_active, sort_order)
values
  ('hair-color', 'Hair color', 'Single-process hair color application and finish.', 200, 90, true, 60),
  ('hairstyle', 'Hairstyle', 'Wash, style, and finish for your preferred look.', 120, 30, true, 70),
  ('hair-treatment', 'Hair treatment', 'Scalp and hair treatment for healthier-looking hair.', 150, 45, true, 80),
  ('shampoo-blowdry', 'Shampoo and blow-dry', 'Hair wash, dry, and basic styling.', 100, 25, true, 90)
on conflict (id) do update
set
  name = excluded.name,
  description = excluded.description,
  duration_minutes = excluded.duration_minutes,
  sort_order = excluded.sort_order,
  is_active = excluded.is_active;
