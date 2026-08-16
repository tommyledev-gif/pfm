package dto

import (
	"github.com/google/uuid"
)

// ChatRequest is the body of POST /ai/chat. The `max=1000` tag necessarily
// repeats common.AIChatMessageMaxLength as a literal — struct tags can't
// reference a Go const (same DateOnlyLayout/TransactionNoteMaxLength
// precedent) — keep the two in sync by hand if this ever changes.
// ConversationID is generated server-side when omitted (specs/ai-chat-assistant/spec.md
// Preconditions).
type ChatRequest struct {
	Message        string     `json:"message" validate:"required,max=1000"`
	ConversationID *uuid.UUID `json:"conversation_id"`
}
