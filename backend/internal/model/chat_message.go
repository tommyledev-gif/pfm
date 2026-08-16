package model

import (
	"time"

	"github.com/google/uuid"
)

type ChatRole string

const (
	ChatRoleUser      ChatRole = "user"
	ChatRoleAssistant ChatRole = "assistant"
)

type ChatIntent string

const (
	ChatIntentCreateTransaction ChatIntent = "create_transaction"
	ChatIntentAmbiguous         ChatIntent = "ambiguous"
)

// ChatMessage is the domain representation of the chat_messages table. Zero
// framework imports, same convention as model.Transaction/model.Notification.
// Append-only — no DeletedAt (specs/ai-chat-assistant/spec.md Domain Objects
// note, mirrors Notification's own no-soft-delete precedent). TransactionIDs
// stays nil/empty for every message this feature writes — linking a
// confirmed Transaction back to its message is explicitly deferred (Open
// Question #8).
type ChatMessage struct {
	ID             uuid.UUID
	UserID         uuid.UUID
	ConversationID uuid.UUID
	Role           ChatRole
	Content        string
	Intent         *ChatIntent
	TransactionIDs []uuid.UUID
	CreatedAt      time.Time
}
