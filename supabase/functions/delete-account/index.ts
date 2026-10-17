/**
 * Permanently deletes the caller's account.
 *
 * Runs on the service role, which bypasses RLS, so it deletes by the id taken
 * from the verified JWT and never from the request body. There is no body.
 *
 * Order is deliberate: every child row first, auth.users last. auth.users is
 * the one delete that cannot be retried after it succeeds, because it takes the
 * caller's session with it. If a child delete fails the function stops and says
 * so, which leaves a still-signed-in customer who can press the button again.
 *
 * Cascades in the schema would eventually remove these rows anyway, but they
 * are deleted explicitly and each result is checked: an unhandled error here
 * used to fall through to a successful auth.users delete, and the customer was
 * told their account was gone while the rows sat there with nothing referencing
 * them.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, DELETE, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });

/**
 * Rows keyed directly by user id, in the order they have to go.
 *
 * The key column is per table and not optional: profiles keys its primary key
 * on `id` while face_profiles and chat_conversations use `user_id`, so a shared
 * `user_id` filter is a column that does not exist on one of them.
 *
 * The label is what the customer reads, so the table name never leaks out.
 */
const CHILD_TABLES = [
  { table: 'profiles', key: 'id', label: 'profile' },
  { table: 'face_profiles', key: 'user_id', label: 'face shape reading' },
  { table: 'chat_conversations', key: 'user_id', label: 'Trimo chats' },
] as const;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'POST' && req.method !== 'DELETE') {
    return json({ error: 'Method not allowed' }, 405);
  }

  const auth = req.headers.get('Authorization');
  if (!auth) return json({ error: 'Missing authorization header' }, 401);

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

  // Without the service key every delete below silently affects zero rows,
  // because anon-key writes are rejected by RLS. That used to look identical
  // to success, so it is worth failing loudly instead.
  if (!supabaseUrl || !serviceKey || !anonKey) {
    console.error('delete-account is missing Supabase environment variables.');
    return json({ error: 'Account deletion is misconfigured on our side. Nothing has been deleted.' }, 500);
  }

  // The caller's own token decides who they are. Passed to getUser() directly
  // rather than relying on a global header merge, so the lookup does not depend
  // on which header the client happens to write.
  const caller = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
  const token = auth.replace(/^Bearer\s+/i, '').trim();

  const { data: userData, error: userError } = await caller.auth.getUser(token);
  if (userError || !userData?.user) return json({ error: 'Not signed in' }, 401);

  const callerId = userData.user.id;

  // Optional. The body carries a confirmation, never an identity.
  try {
    const body = await req.json();
    if (body?.confirm !== 'DELETE') {
      return json({ error: 'Confirmation missing' }, 400);
    }
  } catch {
    return json({ error: 'Confirmation missing' }, 400);
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });

  // The conversation ids are read first because chat_messages hangs off
  // chat_conversations: .in() needs the values, not the query that produces
  // them. An earlier version passed that query straight through, and a further
  // one before that matched an empty-string conversation_id, which matches
  // nothing. Both looked like cleanup and were not.
  const { data: conversations, error: conversationsError } = await admin
    .from('chat_conversations')
    .select('id')
    .eq('user_id', callerId);

  if (conversationsError) {
    console.error('Could not read conversations:', conversationsError);
    return json({ error: 'Could not read your Trimo chats, so nothing has been deleted. Try again in a moment.' }, 500);
  }

  const conversationIds = (conversations ?? []).map((row) => row.id);
  if (conversationIds.length > 0) {
    const { error: messagesError } = await admin
      .from('chat_messages')
      .delete()
      .in('conversation_id', conversationIds);

    if (messagesError) {
      console.error('Could not delete messages:', messagesError);
      return json({ error: 'Could not delete your Trimo messages, so nothing has been deleted. Try again in a moment.' }, 500);
    }
  }

  for (const { table, key, label } of CHILD_TABLES) {
    const { error: tableError } = await admin.from(table).delete().eq(key, callerId);

    if (tableError) {
      console.error(`Could not delete from ${table}:`, tableError);
      return json(
        { error: `Could not delete your ${label}, so nothing has been deleted. Try again in a moment.` },
        500,
      );
    }
  }

  const { error: deleteError } = await admin.auth.admin.deleteUser(callerId);

  if (deleteError) {
    // Already gone is the outcome that was asked for, so it is not a failure.
    // Repeating a delete has to be safe: a customer who lost the response on a
    // slow connection will press the button again.
    const alreadyGone = /not found/i.test(deleteError.message);

    if (!alreadyGone) {
      console.error('Could not delete the account:', deleteError);
      return json({ error: 'Could not delete your sign-in. Your details are already gone; email support to finish this.' }, 500);
    }
  }

  // Confirms the claim instead of assuming it. Cheap next to the deletes, and
  // it is the difference between "deleted" and "reported as deleted".
  //
  // chat_messages is not listed: it carries no user id, and a row cannot
  // outlive the conversation it points at, so an empty conversation set is
  // proof there are no messages either.
  const leftovers: string[] = [];
  for (const { table, key, label } of CHILD_TABLES) {
    const { count } = await admin
      .from(table)
      .select('*', { count: 'exact', head: true })
      .eq(key, callerId);

    if ((count ?? 0) > 0) leftovers.push(label);
  }

  if (leftovers.length > 0) {
    console.error('Rows survived the delete:', leftovers);
    return json(
      { error: 'Part of your account could not be erased. Email support and we will remove the rest.' },
      500,
    );
  }

  return json({ deleted: true });
});