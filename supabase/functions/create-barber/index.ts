/**
 * Creates a barber account for an administrator.
 *
 * The browser cannot create an auth user with the anon key: signUp replaces the
 * caller's session, and the resulting profile would still have to be promoted.
 * This function runs on the service role, but only after verifying that the
 * caller's own profile says `admin`. The request body never chooses a role.
 *
 * Order is deliberate:
 *   1. Verify the caller and their role.
 *   2. Validate and pre-check the username.
 *   3. Create the confirmed auth user. The handle_new_user trigger creates the
 *      profile in the same transaction, so a bad username rolls it all back.
 *   4. Promote the profile to barber. If that fails, delete the auth user so a
 *      half-provisioned customer account is not left behind.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });

const USERNAME_PATTERN = /^[a-z0-9_]{3,24}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 72;
const MAX_DISPLAY_NAME_LENGTH = 80;

interface RequestBody {
  displayName?: unknown;
  username?: unknown;
  email?: unknown;
  password?: unknown;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const auth = req.headers.get('Authorization');
  if (!auth) return json({ error: 'Missing authorization header' }, 401);

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

  if (!supabaseUrl || !anonKey || !serviceKey) {
    console.error('create-barber is missing Supabase environment variables.');
    return json(
      { error: 'Barber creation is misconfigured on our side. Nothing was created.' },
      500,
    );
  }

  // The caller's own token decides who they are. Passed to getUser() directly
  // so the lookup never depends on a global header merge.
  const caller = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const token = auth.replace(/^Bearer\s+/i, '').trim();

  const { data: userData, error: userError } = await caller.auth.getUser(token);
  if (userError || !userData?.user) return json({ error: 'Not signed in' }, 401);

  const callerId = userData.user.id;

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // The role is read from the database, never from the request. The service
  // client bypasses RLS, which is fine here because the id came from the token.
  const { data: callerProfile, error: callerProfileError } = await admin
    .from('profiles')
    .select('role')
    .eq('id', callerId)
    .single();

  if (callerProfileError) {
    console.error('Could not read the caller role:', callerProfileError);
    return json({ error: 'Could not check your administrator access. Try again.' }, 500);
  }

  if (callerProfile?.role !== 'admin') {
    return json({ error: 'Only administrators can create barber accounts.' }, 403);
  }

  let body: RequestBody;
  try {
    const parsed = await req.json();
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return json({ error: 'Request body is missing.' }, 400);
    }
    body = parsed as RequestBody;
  } catch {
    return json({ error: 'Request body is missing.' }, 400);
  }

  const displayName =
    typeof body.displayName === 'string'
      ? body.displayName.trim().replace(/\s+/g, ' ')
      : '';
  const username =
    typeof body.username === 'string' ? body.username.trim().toLowerCase() : '';
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';

  if (!displayName) {
    return json({ error: 'Enter the barber’s name.' }, 400);
  }
  if (displayName.length > MAX_DISPLAY_NAME_LENGTH) {
    return json(
      { error: `Use a name of at most ${MAX_DISPLAY_NAME_LENGTH} characters.` },
      400,
    );
  }
  if (!USERNAME_PATTERN.test(username)) {
    return json(
      {
        error: 'Use a username of 3–24 lowercase letters, numbers or underscores.',
        field: 'username',
      },
      400,
    );
  }
  if (!EMAIL_PATTERN.test(email)) {
    return json(
      { error: 'That does not look like an email address.', field: 'email' },
      400,
    );
  }
  if (
    password.length < MIN_PASSWORD_LENGTH ||
    password.length > MAX_PASSWORD_LENGTH ||
    /\s/.test(password)
  ) {
    return json(
      {
        error: `Use a password of ${MIN_PASSWORD_LENGTH}–${MAX_PASSWORD_LENGTH} characters without spaces.`,
        field: 'password',
      },
      400,
    );
  }

  // The unique constraint is the final authority, but checking first gives the
  // admin a field-level message instead of a wrapped trigger failure.
  const { data: existingUsername, error: usernameError } = await admin
    .from('profiles')
    .select('id')
    .eq('username', username)
    .maybeSingle();

  if (usernameError) {
    console.error('Could not check the username:', usernameError);
    return json({ error: 'Could not check that username. Try again.' }, 500);
  }

  if (existingUsername) {
    return json({ error: 'That username is already taken.', field: 'username' }, 409);
  }

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    // The app has no verification screen, and an invited barber has to be able
    // to sign in immediately. This does not send a confirmation email.
    email_confirm: true,
    user_metadata: {
      username,
      display_name: displayName,
    },
  });

  if (createError || !created?.user) {
    const message = createError?.message ?? '';
    const code = createError?.code ?? '';

    // The password is never logged. The error object comes from GoTrue and
    // does not contain the request body.
    console.error('Could not create the barber auth user:', createError);

    if (code === 'email_exists' || code === 'user_already_exists') {
      return json({ error: 'That email already has an account.', field: 'email' }, 409);
    }
    if (/username|duplicate key|profiles_username_key/i.test(message)) {
      return json({ error: 'That username is already taken.', field: 'username' }, 409);
    }
    if (/email|already|registered|exists/i.test(message)) {
      return json({ error: 'That email already has an account.', field: 'email' }, 409);
    }
    if (/password/i.test(message)) {
      return json(
        {
          error: `That password was rejected. Use ${MIN_PASSWORD_LENGTH}–${MAX_PASSWORD_LENGTH} characters without spaces.`,
          field: 'password',
        },
        400,
      );
    }

    return json({ error: 'Could not create the barber account. Try again.' }, 500);
  }

  const userId = created.user.id;

  const { data: updated, error: roleError } = await admin
    .from('profiles')
    .update({ role: 'barber' })
    .eq('id', userId)
    .select('id');

  if (roleError || !updated || updated.length === 0) {
    console.error('Could not set the barber role:', roleError);

    const { error: rollbackError } = await admin.auth.admin.deleteUser(userId);
    if (rollbackError) {
      console.error('Could not roll back the barber account:', rollbackError);
      return json(
        {
          error:
            'The account was created but could not be assigned the barber role. Remove it in Supabase Auth, then try again.',
        },
        500,
      );
    }

    return json(
      { error: 'Could not finish creating the barber account. Nothing was created; try again.' },
      500,
    );
  }

  // The profile row was created by handle_new_user in the same transaction as
  // the auth user. Returning the row lets the table update without another
  // request; created_at is only used for display and is set milliseconds later.
  return json(
    {
      account: {
        id: userId,
        username,
        display_name: displayName,
        avatar_url: null,
        email,
        role: 'barber',
        created_at: new Date().toISOString(),
      },
    },
    201,
  );
});
