import { useCallback, useEffect, useRef, useState } from 'react';

import {
  deleteConversation,
  listConversations,
  listMessages,
  sendMessage,
} from './trimo';
import type { ChatMessage, Conversation, SendError } from './trimo';

export interface UseConversations {
  conversations: Conversation[];
  messages: ChatMessage[];
  /** Null until the first exchange creates one. */
  activeId: string | null;
  draft: string;
  isSending: boolean;
  isLoading: boolean;
  error: SendError | null;
  setDraft: (value: string) => void;
  startNewChat: () => void;
  openConversation: (id: string) => Promise<void>;
  removeConversation: (id: string) => Promise<void>;
  send: () => Promise<void>;
}

/**
 * Conversation list, the open thread, and the send cycle.
 *
 * The conversation row is created by the edge function, not here, so a brand
 * new chat has no id until Trimo has actually answered. activeId stays null
 * through that window and the send call passes null to ask for a new one.
 */
export const useConversations = (): UseConversations => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<SendError | null>(null);

  // Guards the send against a double submit: React state is not applied fast
  // enough to stop an impatient second Enter.
  const isSendingRef = useRef(false);

  const refreshConversations = useCallback(async () => {
    try {
      setConversations(await listConversations());
    } catch {
      // A failed list is not worth interrupting the customer over. The thread
      // they are in still works.
    }
  }, []);

  useEffect(() => {
    let active = true;

    refreshConversations().finally(() => {
      if (active) setIsLoading(false);
    });

    return () => {
      active = false;
    };
  }, [refreshConversations]);

  const openConversation = useCallback(async (id: string) => {
    setActiveId(id);
    setError(null);

    try {
      setMessages(await listMessages(id));
    } catch {
      setMessages([]);
    }
  }, []);

  const startNewChat = useCallback(() => {
    setActiveId(null);
    setMessages([]);
    setError(null);
    setDraft('');
  }, []);

  const removeConversation = useCallback(
    async (id: string) => {
      try {
        await deleteConversation(id);
      } catch {
        return;
      }

      setConversations((current) => current.filter((item) => item.id !== id));
      // The open thread disappears with it, rather than leaving a view whose
      // messages have already been deleted.
      setActiveId((current) => (current === id ? null : current));
      setMessages((current) => {
        const stillBelongs = conversations.some(
          (item) => item.id === current[0]?.conversation_id,
        );
        return current.length > 0 && !stillBelongs ? [] : current;
      });
    },
    [conversations],
  );

  const send = useCallback(async () => {
    const text = draft.trim();
    if (text.length === 0 || isSendingRef.current) return;

    isSendingRef.current = true;
    setIsSending(true);
    setError(null);
    setDraft('');

    // Shown immediately; replaced by the persisted rows once they land.
    const optimistic: ChatMessage = {
      id: `pending-${Date.now()}`,
      conversation_id: activeId ?? 'pending',
      role: 'user',
      content: text,
      provider: null,
      created_at: new Date().toISOString(),
    };
    setMessages((current) => [...current, optimistic]);

    try {
      const result = await sendMessage(activeId, text);

      const rows = await listMessages(result.conversationId);
      setMessages(rows);
      setActiveId(result.conversationId);
      await refreshConversations();
    } catch (caught) {
      const failure: SendError =
        typeof caught === 'object' && caught !== null && 'message' in caught
          ? (caught as SendError)
          : { message: 'Trimo could not answer just now. Try again.', retryable: true };

      setError(failure);
      // Put the text back so a retryable failure loses nothing.
      setDraft((current) => (current.length > 0 ? current : text));
      setMessages((current) => current.filter((item) => item.id !== optimistic.id));
    } finally {
      isSendingRef.current = false;
      setIsSending(false);
    }
  }, [activeId, draft, refreshConversations]);

  return {
    conversations,
    messages,
    activeId,
    draft,
    isSending,
    isLoading,
    error,
    setDraft,
    startNewChat,
    openConversation,
    removeConversation,
    send,
  };
};