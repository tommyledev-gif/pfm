-- Client-rendered chat UI cache — separate from chat_messages (which only
-- logs raw role/content/intent to build AI Service conversation context and
-- is never read back by the client). Mobile's chat-store.ts persists the
-- full thread (transaction action payloads, confirmed state, edit history,
-- budget-wizard card state) to on-device storage only; this table lets that
-- same JSON survive a cleared device (logout, reinstall, new device).
-- Payload is stored opaque (plain TEXT, not JSONB) — the backend never
-- inspects its fields, only stores/returns it verbatim by client_message_id,
-- same reasoning budgets/plan.md gave for preferring typed columns over
-- JSONB wherever the backend *does* need to query into the data; here it
-- never does.
CREATE TABLE chat_thread_messages (
    id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id            UUID NOT NULL REFERENCES users(id),
    client_message_id  TEXT NOT NULL,
    payload            TEXT NOT NULL,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, client_message_id)
);

-- No deleted_at — a UI cache, not a financial record (same no-soft-delete
-- precedent as chat_messages/notifications).
CREATE INDEX idx_chat_thread_messages_user_id ON chat_thread_messages (user_id, created_at);
