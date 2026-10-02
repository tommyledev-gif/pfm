-- name: CreateChatMessage :one
-- transaction_ids is left NULL at insert time for both roles in this cut —
-- linking a confirmed Transaction back to its originating message is
-- explicitly deferred (specs/ai-chat-assistant/spec.md Open Question #8,
-- plan.md Finding #8 / AI-T31).
INSERT INTO chat_messages (user_id, conversation_id, role, content, intent)
VALUES ($1, $2, $3, $4, $5)
RETURNING *;

-- name: ListRecentChatMessagesByConversation :many
-- Most-recent-first, capped at $3 — ChatService reverses this back to
-- chronological order before handing it to the AI Service as conversation
-- history, so a follow-up message (e.g. "20k" after "mua cà phê") can be
-- disambiguated using what was already said instead of being judged in
-- isolation.
-- ⚠️ Scoped by user_id on purpose. conversation_id is NOT server-only: the
-- request DTO accepts it (dto.ChatRequest.ConversationID) and ChatService
-- uses it as given, so without this filter anyone holding another User's
-- conversation_id would get that User's messages fed into their own model
-- context — and read back to them by the model.
SELECT * FROM chat_messages
WHERE conversation_id = $1
  AND user_id = $2
ORDER BY created_at DESC
LIMIT $3;
