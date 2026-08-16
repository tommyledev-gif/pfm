CREATE TABLE chat_messages (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES users(id),
    conversation_id UUID NOT NULL,
    role            TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content         TEXT NOT NULL,
    intent          TEXT,
    transaction_ids UUID[],
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- No deleted_at — chat_messages is an append-only historical log with no
-- delete/update operation defined anywhere in spec.md, same reasoning as
-- notifications (F-10) having no soft-delete column either.

CREATE INDEX idx_chat_messages_user_conversation
    ON chat_messages (user_id, conversation_id, created_at);
