-- The two provisioned staff accounts.
--
-- Apply after 0008_staff_roles.sql. Idempotent: it creates the auth users only
-- when the email is absent, confirms them, and then writes the username and
-- role onto the profile row the signup trigger created.
--
-- These are known credentials in a public repository. Change both passwords
-- after the first sign-in, and do not reuse them for a real shop account.
--
--   admin  trimadmin@gmail.com  / TrimAdmin2026*
--   barber vinaganda@gmail.com  / VinaGanda2026*

create extension if not exists pgcrypto with schema extensions;

do $$
declare
  v_admin_id  uuid;
  v_barber_id uuid;
begin
  select id into v_admin_id
  from auth.users
  where lower(email) = 'trimadmin@gmail.com'
  limit 1;

  if v_admin_id is null then
    v_admin_id := gen_random_uuid();

    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data,
      confirmation_token, recovery_token, email_change_token_new, email_change
    ) values (
      '00000000-0000-0000-0000-000000000000',
      v_admin_id,
      'authenticated',
      'authenticated',
      'trimadmin@gmail.com',
      extensions.crypt('TrimAdmin2026*', extensions.gen_salt('bf')),
      now(), now(), now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{}'::jsonb,
      '', '', '', ''
    );

    insert into auth.identities (
      id, user_id, provider_id, identity_data, provider,
      last_sign_in_at, created_at, updated_at
    ) values (
      gen_random_uuid(),
      v_admin_id,
      v_admin_id::text,
      jsonb_build_object('sub', v_admin_id::text, 'email', 'trimadmin@gmail.com'),
      'email',
      now(), now(), now()
    );
  end if;

  select id into v_barber_id
  from auth.users
  where lower(email) = 'vinaganda@gmail.com'
  limit 1;

  if v_barber_id is null then
    v_barber_id := gen_random_uuid();

    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data,
      confirmation_token, recovery_token, email_change_token_new, email_change
    ) values (
      '00000000-0000-0000-0000-000000000000',
      v_barber_id,
      'authenticated',
      'authenticated',
      'vinaganda@gmail.com',
      extensions.crypt('VinaGanda2026*', extensions.gen_salt('bf')),
      now(), now(), now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{}'::jsonb,
      '', '', '', ''
    );

    insert into auth.identities (
      id, user_id, provider_id, identity_data, provider,
      last_sign_in_at, created_at, updated_at
    ) values (
      gen_random_uuid(),
      v_barber_id,
      v_barber_id::text,
      jsonb_build_object('sub', v_barber_id::text, 'email', 'vinaganda@gmail.com'),
      'email',
      now(), now(), now()
    );
  end if;
end $$;

-- A project with "Confirm email" on would otherwise leave both accounts unable
-- to sign in, and this flow has no way to deliver the message.
update auth.users
set email_confirmed_at = coalesce(email_confirmed_at, now()),
    updated_at = now()
where lower(email) in ('trimadmin@gmail.com', 'vinaganda@gmail.com');

update public.profiles p
set username = v.username,
    role = v.role
from (
  values
    ('trimadmin@gmail.com', 'trimadmin', 'admin'),
    ('vinaganda@gmail.com', 'vinaganda', 'barber')
) as v(email, username, role)
join auth.users u on lower(u.email) = v.email
where p.id = u.id;
