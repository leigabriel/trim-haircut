-- Trimo chat. Conversations and their messages, scoped to the signed-in
-- customer.
--
-- RLS covers the client, which reads and deletes directly. It does NOT cover
-- the chat edge function: that runs on the service-role key, which bypasses
-- RLS, so the function scopes every read with an explicit user_id filter. Both
-- halves are required.

create table public.chat_conversations (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users on delete cascade,
  title      text not null default 'New chat',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.chat_messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.chat_conversations on delete cascade,
  role            text not null check (role in ('user', 'assistant')),
  content         text not null check (char_length(content) between 1 and 8000),
  -- Which provider answered: 'gemini' or 'openrouter'. Null on user messages.
  provider        text check (provider in ('gemini', 'openrouter')),
  created_at      timestamptz not null default now(),
  -- An assistant message must say who produced it.
  constraint provider_required_for_assistant
    check (role <> 'assistant' or provider is not null)
);

-- History is always read as one conversation in order.
create index chat_messages_conversation_created
  on public.chat_messages (conversation_id, created_at);

-- The conversation list is always one customer's, newest first.
create index chat_conversations_user_updated
  on public.chat_conversations (user_id, updated_at desc);

alter table public.chat_conversations enable row level security;
alter table public.chat_messages enable row level security;

create policy "read own conversations"
  on public.chat_conversations for select
  using ((select auth.uid()) = user_id);

create policy "create own conversations"
  on public.chat_conversations for insert
  with check ((select auth.uid()) = user_id);

create policy "update own conversations"
  on public.chat_conversations for update
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "delete own conversations"
  on public.chat_conversations for delete
  using ((select auth.uid()) = user_id);

-- Messages carry no user_id of their own; they inherit the conversation's.
-- These policies reach through the parent rather than trusting a column, so a
-- row cannot be read or written by anyone but the conversation's owner.
create policy "read own messages"
  on public.chat_messages for select
  using (
    exists (
      select 1 from public.chat_conversations c
      where c.id = conversation_id
        and c.user_id = (select auth.uid())
    )
  );

create policy "insert own messages"
  on public.chat_messages for insert
  with check (
    exists (
      select 1 from public.chat_conversations c
      where c.id = conversation_id
        and c.user_id = (select auth.uid())
    )
  );

create policy "delete own messages"
  on public.chat_messages for delete
  using (
    exists (
      select 1 from public.chat_conversations c
      where c.id = conversation_id
        and c.user_id = (select auth.uid())
    )
  );

-- No update policy on chat_messages. A sent message is not editable; correcting
-- it means sending a new one.

-- Keeps the conversation list ordered by the time of the latest message.
create or replace function public.touch_conversation()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  update public.chat_conversations
  set updated_at = now()
  where id = new.conversation_id;
  return new;
end;
$$;

create trigger on_chat_message_insert
  after insert on public.chat_messages
  for each row execute function public.touch_conversation();