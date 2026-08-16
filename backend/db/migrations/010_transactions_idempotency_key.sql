ALTER TABLE transactions ADD COLUMN idempotency_key UUID;

-- Partial unique index — NULL keys (every pre-existing row, and every future
-- caller that doesn't send one) never collide with each other or with a real
-- key. A second POST /transactions reusing the same (user_id, idempotency_key)
-- is rejected at the DB level (specs/ai-chat-assistant/spec.md Edge Case #2) —
-- the service layer treats that unique-violation as the signal to look up and
-- return the already-created Transaction instead of erroring.
CREATE UNIQUE INDEX idx_transactions_user_idempotency_key
    ON transactions (user_id, idempotency_key)
    WHERE idempotency_key IS NOT NULL;
