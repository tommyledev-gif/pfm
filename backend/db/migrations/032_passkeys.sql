-- Passkeys (WebAuthn): a key pair made on the user's phone, the private half
-- never leaving it, the public half stored here against the account.
--
-- Replaces the device-only fingerprint check: signing in, or switching to a
-- saved account, can now be a passkey assertion the SERVER verifies against
-- this table, so the check belongs to the account rather than to whichever
-- phone happens to hold it.
--
-- `credential` is go-webauthn's own Credential record as JSON (public key,
-- sign counter, flags, attestation) — the library reads it back as is, so
-- the schema does not have to track every field it may add. The columns
-- beside it are only what queries need: lookup by credential id, the owner,
-- and what the Security screen lists.
--
-- ⚠️ Apply BEFORE the backend that reads these tables starts. Idempotent,
-- same convention as 022-031.

CREATE TABLE IF NOT EXISTS passkeys (
    id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id        UUID NOT NULL REFERENCES users(id),
    credential_id  BYTEA NOT NULL,
    credential     JSONB NOT NULL,
    -- The device it was made on, as the app reported it ("Pixel 8").
    name           TEXT NOT NULL,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_used_at   TIMESTAMPTZ NULL,
    deleted_at     TIMESTAMPTZ NULL
);

-- A credential id is globally unique among live passkeys; a deleted one may
-- be registered again.
CREATE UNIQUE INDEX IF NOT EXISTS idx_passkeys_credential_id_live
    ON passkeys (credential_id)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_passkeys_user_live
    ON passkeys (user_id, created_at DESC)
    WHERE deleted_at IS NULL;

-- One row per started ceremony (register or sign in), consumed — deleted —
-- by the request that finishes it, so a challenge can never be answered
-- twice. user_id is NULL for a sign-in that has not said who it is for.
CREATE TABLE IF NOT EXISTS passkey_challenges (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id     UUID NULL REFERENCES users(id),
    purpose     TEXT NOT NULL CHECK (purpose IN ('register', 'login')),
    session     JSONB NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at  TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_passkey_challenges_expires_at
    ON passkey_challenges (expires_at);
