-- name: CreateChatMessage :one
-- transaction_ids is left NULL at insert time for both roles in this cut —
-- linking a confirmed Transaction back to its originating message is
-- explicitly deferred (specs/ai-chat-assistant/spec.md Open Question #8,
-- plan.md Finding #8 / AI-T31).
INSERT INTO chat_messages (user_id, conversation_id, role, content, intent)
VALUES ($1, $2, $3, $4, $5)
RETURNING *;
