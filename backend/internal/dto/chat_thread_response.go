package dto

import "encoding/json"

// ChatThreadMessageResponse mirrors ChatThreadMessageSync — Payload is
// re-emitted exactly as stored (opaque JSON), never re-shaped server-side.
type ChatThreadMessageResponse struct {
	ClientMessageID string          `json:"client_message_id"`
	Payload         json.RawMessage `json:"payload"`
}

// GetChatThreadResponse is the body of GET /ai/chat/thread — oldest first,
// ready to drop straight into mobile chat-store.ts's `thread` array.
// HasMore is set when a paged request (GetChatThreadQuery.Limit) left older
// messages behind; an unpaged request always returns everything, so false.
type GetChatThreadResponse struct {
	Messages []ChatThreadMessageResponse `json:"messages"`
	HasMore  bool                        `json:"has_more"`
}
