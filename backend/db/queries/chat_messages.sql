-- name: CreateChatMessage :one
-- transaction_ids is left NULL at insert time for both roles in this cut —
-- linking a confirmed Transaction back to its originating message is
-- explicitly deferred (specs/ai-chat-assistant/spec.md Open Question #8,
-- plan.md Finding #8 / AI-T31).
INSERT INTO chat_messages (user_id, conversation_id, role, content, intent)
VALUES ($1, $2, $3, $4, $5)
RETURNING *;

-- name: ListRecentChatMessagesByConversation :many
-- Most-recent-first, capped at $2 — ChatService reverses this back to
-- chronological order before handing it to the AI Service as conversation
-- history, so a follow-up message (e.g. "20k" after "mua cà phê") can be
-- disambiguated using what was already said instead of being judged in
-- isolation. Not scoped by user_id: conversation_id is a server-generated
-- UUIDv4 ChatService itself created and only ever hands back to its own
-- caller (see Chat()'s own conversationID handling) — there is no path by
-- which a caller can supply another user's conversation_id.
SELECT * FROM chat_messages
WHERE conversation_id = $1
ORDER BY created_at DESC
LIMIT $2;
