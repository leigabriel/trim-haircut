/**
 * Trimo chat.
 *
 * Gemini first, OpenRouter when Gemini cannot answer. The keys are edge
 * secrets and never reach the browser.
 *
 * Isolation note, and it matters: this function runs on the service-role key,
 * which bypasses row level security. RLS does NOT protect anything here. The
 * explicit user_id filters below are the only thing standing between one
 * customer and another's conversations, so they are not optional and not to be
 * replaced with a lookup by conversation_id alone.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

import { buildSystemPrompt } from './prompt.ts';
import { callWithFailover } from './providers.ts';
import type { ChatMessage, ProviderConfig } from './providers.ts';

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

/** Characters of prior turns sent to the provider. */
const HISTORY_LIMIT = 20;
/** Messages sent per customer per minute, to bound the key's exposure. */
const RATE_LIMIT = 20;

interface RequestBody {
  conversationId?: string | null;
  message?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {

  const auth = req.headers.get('Authorization');
  if (!auth) return json({ error: 'Missing authorization header' }, 401);

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

  // Verified with the caller's own token. This is where callerId comes from:
  // never from the request body, which would be trivially spoofable.
  const caller = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: auth } },
  });

  const { data: userData, error: userError } = await caller.auth.getUser();
  if (userError || !userData?.user) return json({ error: 'Not signed in' }, 401);
  const callerId = userData.user.id;

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });

  // Rate limit before any provider call.
  const { count } = await admin
    .from('chat_messages')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', new Date(Date.now() - 60_000).toISOString())
    .eq('role', 'user');

  // Counted across all traffic because the service role cannot see a per-user
  // count cheaply; the ceiling is deliberately blunt.
  if ((count ?? 0) >= RATE_LIMIT * 20) {
    return json({ error: 'Trimo is busy. Try again in a minute.', retryable: true }, 429);
  }

  let body: RequestBody;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const message = (body.message ?? '').trim();
  if (message.length === 0) return json({ error: 'Message is empty' }, 400);
  if (message.length > 4000) return json({ error: 'Message is too long' }, 400);

  // Ownership check. Scoped by callerId on purpose: see the isolation note.
  let conversationId = body.conversationId ?? null;
  let isNew = false;

  if (conversationId) {
    const { data: owned, error: ownedError } = await admin
      .from('chat_conversations')
      .select('id')
      .eq('id', conversationId)
      .eq('user_id', callerId)
      .maybeSingle();

    if (ownedError) return json({ error: 'Could not read the conversation' }, 500);

    // Not found, or found but owned by someone else. Same answer either way, so
    // a wrong id is indistinguishable from one that never existed.
    if (!owned) return json({ error: 'Conversation not found' }, 404);
  } else {
    isNew = true;
  }

  // The customer's own profile, for the prompt's context block.
  const { data: profile } = await admin
    .from('profiles')
    .select('username, created_at')
    .eq('id', callerId)
    .maybeSingle();

  // The face reading lives in its own table, not on profiles. Read it here so
  // Trimo can answer from the customer's actual shape.
  const { data: face } = await admin
    .from('face_profiles')
    .select('shape, source, confidence, forehead_ratio, jaw_ratio, length_ratio')
    .eq('user_id', callerId)
    .maybeSingle();

  let systemPrompt: string;
  try {
    systemPrompt = await buildSystemPrompt({
      username: profile?.username ?? null,
      faceShape: face?.shape ?? null,
      faceShapeSource: face?.source ?? null,
      faceShapeConfidence: face?.confidence ?? null,
      faceMeasurements: face
        ? {
            forehead: face.forehead_ratio === null ? null : Math.round(face.forehead_ratio * 100),
            jaw: face.jaw_ratio === null ? null : Math.round(face.jaw_ratio * 100),
            length: face.length_ratio === null ? null : Math.round(face.length_ratio * 100),
          }
        : null,
      createdAt: profile?.created_at ?? null,
    });
  } catch (error) {
    console.error('Prompt assembly failed:', error);
    return json({ error: 'Trimo is not configured correctly.' }, 500);
  }

  // The caller's own messages for this conversation, oldest first.
  let history: ChatMessage[] = [];
  if (conversationId) {
    const { data: rows } = await admin
      .from('chat_messages')
      .select('role, content')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(HISTORY_LIMIT);

    history = (rows ?? [])
      .reverse()
      .map((row) => ({ role: row.role as ChatMessage['role'], content: row.content }));
  }

  const providers: ProviderConfig[] = [];
  const geminiKey = Deno.env.get('GEMINI_API_KEY');
  const openrouterKey = Deno.env.get('OPENROUTER_API_KEY');

  if (geminiKey) {
    providers.push({
      id: 'gemini',
      url: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
      apiKey: geminiKey,
      model: Deno.env.get('GEMINI_MODEL') ?? 'gemini-3.8-flash',
      // Stated explicitly as well as defaulted in buildRequestBody, because the
      // reason is not obvious and the next reader needs it. Gemini 3.x defaults
      // to a medium thinking level and thinking tokens count against
      // max_tokens; lowering the level is the fix Google documents, rather
      // than shrinking the ceiling.
      reasoningEffort: 'low',
    });
  }

  if (openrouterKey) {
    providers.push({
      id: 'openrouter',
      url: 'https://openrouter.ai/api/v1/chat/completions',
      apiKey: openrouterKey,
      model: Deno.env.get('OPENROUTER_MODEL') ?? '',
    });
  }

  if (providers.length === 0) {
    return json({ error: 'No AI provider is configured.' }, 500);
  }

  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    ...history,
    { role: 'user', content: message },
  ];

  const result = await callWithFailover(providers, messages);

  if (!result.ok) {
    for (const failure of result.errors) {
      console.error(`Provider ${failure.provider} failed (${failure.status}):`, failure.body);
    }
    return json(
      {
        error: 'Trimo could not answer just now. Try again in a moment.',
        retryable: true,
      },
      502,
    );
  }

  // Create the conversation only once there is a reply, so an empty chat never
  // lands in the list. Title is the opening line, trimmed to something short.
  if (isNew) {
    const { data: created, error: createError } = await admin
      .from('chat_conversations')
      .insert({ user_id: callerId, title: message.slice(0, 60) })
      .select('id')
      .single();

    if (createError || !created) {
      console.error('Could not create the conversation:', createError);
      return json({ error: 'Could not start the conversation' }, 500);
    }

    conversationId = created.id;
  }

  const { error: userInsertError } = await admin.from('chat_messages').insert({
    conversation_id: conversationId,
    role: 'user',
    content: message,
  });

  const { error: assistantInsertError } = await admin.from('chat_messages').insert({
    conversation_id: conversationId,
    role: 'assistant',
    content: result.value.content,
    provider: result.value.provider,
  });

  if (userInsertError || assistantInsertError) {
    console.error('Could not save the messages:', userInsertError ?? assistantInsertError);
    return json({ error: 'Could not save the reply' }, 500);
  }

  return json({
    conversationId,
    reply: result.value.content,
    provider: result.value.provider,
  });

  } catch (err) {
    console.error('Unhandled error in chat function:', err);
    return json(
      { error: 'An unexpected error occurred.', retryable: true },
      500,
    );
  }
});