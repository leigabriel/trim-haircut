import { useEffect, useRef } from 'react';

import type { UseConversations } from './useConversations';

interface ChatViewProps {
  chat: UseConversations;
  /**
   * A question carried in from elsewhere, such as the Face Shape section's
   * "Ask Trimo about this". Prefilled into the composer rather than sent, so
   * the customer can read it, change it, or add to it before it goes.
   */
  pendingPrompt?: string | null;
}

const STARTERS = [
  'What cut suits my face shape?',
  'How do I describe this to my barber?',
  'How long before I need a refresh?',
];

/** Main viewport for the AI view: the thread, then the composer. */
const ChatView: React.FC<ChatViewProps> = ({ chat, pendingPrompt }) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Only fills an empty composer. Sending the same prompt twice would otherwise
  // be impossible once the customer had started typing.
  const handledPrompt = useRef<string | null>(null);
  useEffect(() => {
    if (!pendingPrompt || handledPrompt.current === pendingPrompt) return;

    handledPrompt.current = pendingPrompt;
    if (chat.draft.trim().length === 0) {
      chat.setDraft(pendingPrompt);
      inputRef.current?.focus();
    }
  }, [pendingPrompt, chat]);

  // Follow the thread as it grows, the way every chat does.
  useEffect(() => {
    const node = scrollRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [chat.messages, chat.isSending]);

  const onKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter sends, Shift+Enter breaks the line.
    if (event.key !== 'Enter' || event.shiftKey) return;
    event.preventDefault();
    void chat.send();
  };

  const isEmpty = chat.messages.length === 0;

  return (
    <div className="trim-chat">
      <div className="trim-chat__thread" ref={scrollRef} aria-live="polite">
        {isEmpty ? (
          <div className="trim-chat__welcome">
            <img
              className="trim-chat__mark"
              src="/assets/ui/trimo.png"
              alt="Trimo"
              width={394}
              height={394}
            />
            <h1 className="trim-chat__welcome-title">Ask Trimo</h1>
            <p className="trim-chat__welcome-lede">
              Trimo knows your face shape, your hair and how often you get cut. Ask what
              would suit you, or what to say when you are in the chair.
            </p>

            <ul className="trim-chat__starters">
              {STARTERS.map((starter) => (
                <li key={starter}>
                  <button
                    className="trim-chat__starter"
                    type="button"
                    onClick={() => {
                      chat.setDraft(starter);
                      inputRef.current?.focus();
                    }}
                  >
                    {starter}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          chat.messages.map((message) => (
            <article
              className={`trim-bubble trim-bubble--${message.role}`}
              key={message.id}
            >
              {/* Provider is stored but not shown: which model answered is
                  diagnostics, not something a customer needs to read. */}
              <p className="trim-bubble__role">
                {/* Decorative: the label beside it already names the speaker. */}
                {message.role === 'assistant' ? (
                  <img
                    className="trim-bubble__avatar"
                    src="/assets/ui/trimo.png"
                    alt=""
                    width={394}
                    height={394}
                  />
                ) : null}
                <span>{message.role === 'user' ? 'You' : 'Trimo'}</span>
              </p>
              <p className="trim-bubble__text">{message.content}</p>
            </article>
          ))
        )}

        {chat.isSending ? (
          <p className="trim-chat__thinking">Trimo is thinking</p>
        ) : null}
      </div>

      {chat.error ? (
        <p className="trim-chat__error" role="alert">
          {chat.error.message}
        </p>
      ) : null}

      <form
        className="trim-chat__composer"
        onSubmit={(event) => {
          event.preventDefault();
          void chat.send();
        }}
      >
        <label className="trim-visually-hidden" htmlFor="trim-chat-input">
          Message Trimo
        </label>
        <textarea
          id="trim-chat-input"
          ref={inputRef}
          className="trim-chat__input"
          value={chat.draft}
          rows={1}
          placeholder="Ask about your hair"
          onChange={(event) => chat.setDraft(event.target.value)}
          onKeyDown={onKeyDown}
          disabled={chat.isSending}
        />
        <button
          className="trim-chat__send"
          type="submit"
          disabled={chat.isSending || chat.draft.trim().length === 0}
        >
          {chat.isSending ? 'Sending' : 'Send'}
        </button>
      </form>
    </div>
  );
};

export default ChatView;