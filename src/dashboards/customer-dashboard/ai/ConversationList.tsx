import type { UseConversations } from './useConversations';

interface ConversationListProps {
  chat: UseConversations;
}

/**
 * Middle column for the Trimo view: a list of the customer's own chats, newest
 * first, with new and delete on each. The only view that keeps a middle column,
 * which is why the grid carries a modifier for it rather than for the views
 * without one.
 */
const ConversationList: React.FC<ConversationListProps> = ({ chat }) => (
  <div className="trim-chat-list" aria-label="Your conversations">
    <div className="trim-chat-list__head">
      <p className="trim-dash__list-title">Chats</p>
      <button className="trim-chat-list__new" type="button" onClick={chat.startNewChat}>
        New
      </button>
    </div>

    {chat.isLoading ? (
      <p className="trim-chat-list__empty">Loading your chats</p>
    ) : chat.conversations.length === 0 ? (
      <p className="trim-chat-list__empty">
        No chats yet. Ask Trimo something and it starts here.
      </p>
    ) : (
      <ul className="trim-chat-list__items">
        {chat.conversations.map((conversation) => {
          const isActive = conversation.id === chat.activeId;

          return (
            <li key={conversation.id}>
              <div className={`trim-chat-list__item${isActive ? ' trim-chat-list__item--current' : ''}`}>
                <button
                  className="trim-chat-list__open"
                  type="button"
                  aria-current={isActive ? 'page' : undefined}
                  onClick={() => chat.openConversation(conversation.id)}
                >
                  <span className="trim-chat-list__title">{conversation.title}</span>
                  <span className="trim-chat-list__date">
                    {new Date(conversation.updated_at).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </span>
                </button>

                <button
                  className="trim-chat-list__delete"
                  type="button"
                  onClick={() => chat.removeConversation(conversation.id)}
                  aria-label={`Delete ${conversation.title}`}
                >
                  <svg viewBox="0 0 24 24" width="15" height="15" fill="none" aria-hidden="true">
                    <path
                      d="M5 7h14M9 7V5h6v2M7 7l1 12h8l1-12M10 11v5M14 11v5"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    )}
  </div>
);

export default ConversationList;