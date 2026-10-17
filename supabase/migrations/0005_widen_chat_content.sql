-- Widen the saved-message ceiling.
--
-- chat_messages.content was capped at 8000 characters, chosen back when the
-- provider was sent max_tokens: 600. 600 tokens cannot reach 8000 characters,
-- so the two limits agreed by accident.
--
-- The provider now sends max_tokens: 2048, because Gemini counts thinking
-- tokens against that budget and 600 was cutting replies off mid-sentence (see
-- supabase/functions/chat/providers.ts). 2048 tokens can produce roughly
-- 10,000 characters, which is over the old ceiling.
--
-- Without this, a long answer is rejected by the check constraint and the
-- function returns "Could not save the reply" after the question has already
-- been stored. 16000 keeps the token limit the binding constraint, so every
-- over-length reply fails in one place instead of two: the provider reports
-- finish_reason "length", and the failover tries the other provider.

alter table public.chat_messages
  drop constraint if exists chat_messages_content_check;

alter table public.chat_messages
  add constraint chat_messages_content_check
  check (char_length(content) between 1 and 16000);