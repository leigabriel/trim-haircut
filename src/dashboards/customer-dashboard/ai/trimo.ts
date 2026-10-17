import { supabase } from '../../../lib/supabase';

export type ChatRole = 'user' | 'assistant';
export type ChatProvider = 'gemini' | 'openrouter';

export interface ChatMessage {
  id: string;
  conversation_id: string;
  role: ChatRole;
  content: string;
  provider: ChatProvider | null;
  created_at: string;
}

export interface Conversation {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface SendResult {
  conversationId: string;
  reply: string;
  provider: ChatProvider;
}

export interface SendError {
  message: string;
  /** True when the same message is worth sending again. */
  retryable: boolean;
}

const FALLBACK_ERROR: SendError = {
  message: 'Trimo could not answer just now. Try again.',
  retryable: true,
};

/**
 * supabase-js hands back the raw Response on a non-2xx as error.context, so
 * the function's own message can be read out of it. "Edge Function returned a
 * non-2xx status code" on its own tells the customer nothing.
 */
const readFunctionError = async (error: unknown): Promise<SendError> => {
  const context = (error as { context?: unknown }).context;

  if (context instanceof Response) {
    try {
      const body = (await context.json()) as { error?: unknown; retryable?: unknown };
      if (typeof body.error === 'string') {
        return {
          message: body.error,
          retryable: body.retryable !== false,
        };
      }
    } catch {
      // Body was not JSON. Fall through to the generic message.
    }
  }

  return FALLBACK_ERROR;
};

export const listConversations = async (): Promise<Conversation[]> => {
  const { data, error } = await supabase
    .from('chat_conversations')
    .select('id, title, created_at, updated_at')
    .order('updated_at', { ascending: false });

  if (error) throw new Error(error.message);
  return data ?? [];
};

export const listMessages = async (conversationId: string): Promise<ChatMessage[]> => {
  const { data, error } = await supabase
    .from('chat_messages')
    .select('id, conversation_id, role, content, provider, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });

  if (error) throw new Error(error.message);
  return data ?? [];
};

/**
 * The conversation row is created by the edge function, on the first message
 * that earns a reply. So a new chat starts as null here and becomes real once
 * Trimo has answered.
 */
export const deleteConversation = async (conversationId: string): Promise<void> => {
  const { error } = await supabase
    .from('chat_conversations')
    .delete()
    .eq('id', conversationId);

  if (error) throw new Error(error.message);
};

export const sendMessage = async (
  conversationId: string | null,
  message: string,
): Promise<SendResult> => {
  const { data, error } = await supabase.functions.invoke<SendResult>('chat', {
    body: { conversationId, message },
  });

  if (error) throw await readFunctionError(error);

  if (!data?.conversationId || typeof data.reply !== 'string') {
    throw { message: 'Trimo sent back something unreadable.', retryable: true } satisfies SendError;
  }

  return data;
};