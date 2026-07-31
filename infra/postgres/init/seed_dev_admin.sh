#!/bin/sh
# Dev-only seed: creates the first admin user so the stack is usable right
# after `docker compose up --build` without a manual psql step. Only runs on
# the *first* init of an empty postgres volume (postgres image behavior) —
# never re-applied against an existing database, so it never touches prod.
# Credentials come from ADMIN_SEED_EMAIL / ADMIN_SEED_PASSWORD_HASH (.env) —
# nothing hardcoded here.
set -e

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
INSERT INTO users (email, password_hash, status, role)
VALUES ('$ADMIN_SEED_EMAIL', '$ADMIN_SEED_PASSWORD_HASH', 'active', 'admin')
ON CONFLICT (email) WHERE deleted_at IS NULL DO NOTHING;
EOSQL
