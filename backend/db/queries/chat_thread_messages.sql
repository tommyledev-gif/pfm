-- name: UpsertChatThreadMessage :one
-- One row per client-generated message id — re-syncing an already-edited
-- message (edited/confirmed/editHistory changed) overwrites the stored
-- payload in place instead of accumulating duplicate rows.
INSERT INTO chat_thread_messages (user_id, client_message_id, payload)
VALUES ($1, $2, $3)
ON CONFLICT (user_id, client_message_id)
DO UPDATE SET payload = EXCLUDED.payload, updated_at = NOW()
RETURNING *;

-- name: ListChatThreadMessagesByUser :many
-- Oldest first — mirrors mobile chat-store.ts's own thread ordering, so the
-- client can drop this response straight into its `thread` array.
SELECT * FROM chat_thread_messages
WHERE user_id = $1
ORDER BY created_at ASC;

-- name: ListChatThreadMessagesPage :many
-- Newest first, at most $2 rows: the latest page of the thread, or the page
-- just older than the message the client already holds (before_client_message_id).
-- The cursor is a client message id, not a server timestamp, because the client
-- only knows its own ids; it resolves inside the same user's rows. An id the
-- server never received matches nothing, so that page comes back empty.
SELECT t.* FROM chat_thread_messages t
WHERE t.user_id = $1
  AND (
    sqlc.narg('before_client_message_id')::text IS NULL
    OR (t.created_at, t.id) < (
      SELECT c.created_at, c.id FROM chat_thread_messages c
      WHERE c.user_id = $1 AND c.client_message_id = sqlc.narg('before_client_message_id')
    )
  )
ORDER BY t.created_at DESC, t.id DESC
LIMIT $2;
