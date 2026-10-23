package dto

import "encoding/json"

// ChatThreadMessageSync is one client-rendered chat message being synced to
// the server-side thread cache. Payload is passed through opaque — the exact
// JSON mobile's chat-store.ts holds for this message (transaction action
// payload, confirmed state, edit history, budget-wizard card state, ...) —
// the backend never inspects its fields, only stores it verbatim keyed by
// ClientMessageID so a later edit to the same message overwrites in place.
//
// Bounded (specs/security-hardening-2026-10 US-09) so the cache cannot be used
// as free storage: an id of at most 200 characters (mobile ids are
// "msg_<ms>_<n>", about 25) and a payload of at most 64 KiB (a message with
// its action cards and edit history is a few KB).
type ChatThreadMessageSync struct {
	ClientMessageID string          `json:"client_message_id" validate:"required,max=200"`
	Payload         json.RawMessage `json:"payload" validate:"required,max=65536"`
}

// SyncChatThreadRequest is the body of POST /ai/chat/thread/sync — a debounced
// upsert of the messages changed since the last sync (mobile: 3s after the
// last chat activity, plus a best-effort flush on logout before the local
// AsyncStorage copy is cleared). At most 500 messages per request.
type SyncChatThreadRequest struct {
	Messages []ChatThreadMessageSync `json:"messages" validate:"required,min=1,max=500,dive"`
}

// GetChatThreadQuery is the query string of GET /ai/chat/thread. Both fields
// are optional: a client that sends neither (an app build from before
// paging) still gets the whole thread, exactly as before. `limit` asks for
// the latest that many messages; `before` (a client message id the caller
// already holds) asks for the page just older than it — the chat screen's
// lazy load as the User scrolls back.
type GetChatThreadQuery struct {
	Limit  int    `query:"limit" validate:"omitempty,min=1,max=200"`
	Before string `query:"before" validate:"omitempty,max=200"`
}
