#!/usr/bin/env bash
# Pulls the freshly-pushed backend image and (re)starts the stack on the VPS.
# Invoked over SSH by .github/workflows/deploy-backend.yml (and
# deploy-ai-service.yml) after docker-compose.yml + deploy.sh + ops/ are
# synced. The migrations ship inside the backend image (db/migrations.go).
#
# Expects to be run from the directory it was synced into, with:
#   - .env.prod already present (workflow writes it from the VPS_ENV_PROD secret)
#   - DOCKER_REGISTRY_USER and PFM_BACKEND_IMAGE_TAG exported by the caller
set -euo pipefail

cd "$(dirname "$0")"

ENV_FILE_PATH="${ENV_FILE_PATH:-.env.prod}"
if [ ! -f "$ENV_FILE_PATH" ]; then
  echo "Missing $ENV_FILE_PATH — create it on the VPS before deploying." >&2
  exit 1
fi
# Every secret the stack has is in this file. Owner-only on every deploy, so a
# copy written by hand (or by an older workflow without the umask) is fixed
# too. The ops cron jobs run as this same user and still read it.
chmod 600 "$ENV_FILE_PATH"

# Refuse to deploy on an env file missing anything docker-compose.yml
# interpolates *without* a `:-` default. Compose only warns about those and
# then substitutes an empty string, so the stack comes up looking fine and is
# entirely broken: a blank POSTGRES_USER/DB yields
# `postgres://:@pfm-postgres:5432/?sslmode=disable`, the API answers its own
# health check, and every single query fails with
# `FATAL: no PostgreSQL user name specified in startup packet` (SQLSTATE
# 28000). That is not a state worth reaching — fail here, before anything is
# pulled or recreated.
#
# POSTGRES_* are the three that actually go missing in practice. They are
# compose-level only: the backend container receives the assembled
# DATABASE_URL and never the parts, so rebuilding this file from
# `docker inspect pfm-backend-container` silently drops all three (and
# GROQ_API_KEY/ANTHROPIC_API_KEY, which live on the ai-service container).
# backend/.env.prod.example is the canonical list to rebuild from.
#
# Values are never echoed — only names.
missing=""
for var in POSTGRES_USER POSTGRES_PASSWORD POSTGRES_DB JWT_SECRET CORS_ALLOWED_ORIGINS APP_BASE_URL; do
  if ! grep -qE "^[[:space:]]*${var}=.+" "$ENV_FILE_PATH"; then
    missing="$missing $var"
  fi
done
# Exported by the workflow rather than written into the env file.
if [ -z "${DOCKER_REGISTRY_USER:-}" ]; then
  missing="$missing DOCKER_REGISTRY_USER"
fi
if [ -n "$missing" ]; then
  echo "Refusing to deploy — missing or empty in $ENV_FILE_PATH:$missing" >&2
  echo "These have no default in docker-compose.yml; compose would substitute an empty string." >&2
  echo "Rebuild the VPS_ENV_PROD secret from backend/.env.prod.example." >&2
  exit 1
fi

# A JWT_SECRET under 32 bytes is guessable offline from any token, after which
# anyone can mint a token for any user. The server itself refuses to start with
# one (internal/config), but by then compose has already replaced the working
# container and the health check would take minutes to give up and roll back.
# Refuse here instead, before anything is pulled or recreated. Only the length
# is read, never the value.
jwt_secret_length="$(awk -F= '/^[[:space:]]*JWT_SECRET=/ { v = substr($0, index($0, "=") + 1); gsub(/\r/, "", v); gsub(/^["\047]|["\047]$/, "", v); n = length(v) } END { print n + 0 }' "$ENV_FILE_PATH")"
if [ "$jwt_secret_length" -lt 32 ]; then
  echo "Refusing to deploy — JWT_SECRET in $ENV_FILE_PATH is $jwt_secret_length bytes; it must be at least 32." >&2
  echo "Generate one with: openssl rand -hex 32, and update the VPS_ENV_PROD secret (docs/ops-runbook.md §6)." >&2
  exit 1
fi

env_has() { grep -qE "^[[:space:]]*$1=.+" "$ENV_FILE_PATH"; }

# Cloudflare Tunnel (docs/ops-runbook.md). The tunnel service only starts
# with a token; closing the public port without one would take the API
# offline, so that combination is refused rather than deployed.
services="pfm-postgres pfm-backend ai-service"
if env_has CLOUDFLARE_TUNNEL_TOKEN; then
  export COMPOSE_PROFILES=tunnel
  services="$services pfm-cloudflared"
elif grep -qE "^[[:space:]]*BACKEND_BIND_ADDRESS=127\.0\.0\.1" "$ENV_FILE_PATH"; then
  echo "Refusing to deploy — BACKEND_BIND_ADDRESS=127.0.0.1 without CLOUDFLARE_TUNNEL_TOKEN leaves the API unreachable." >&2
  exit 1
fi

# `docker compose pull` (no service arg) fetches every service's image
# concurrently, which is the trigger for a known containerd race
# (moby/moby#43910, containerd/containerd#4931): a content lease created for
# one image can get garbage-collected mid-pull by another image's concurrent
# pull, failing with "failed to lease content: NotFound: lease ... not
# found". Pulling one service at a time sidesteps the race entirely; the
# retry loop covers the rarer case where a single pull still hits daemon-side
# GC pressure on its own.
pull_with_retry() {
  service="$1"
  attempts=3
  i=1
  while [ "$i" -le "$attempts" ]; do
    if docker compose --env-file "$ENV_FILE_PATH" pull "$service"; then
      return 0
    fi
    echo "Pull of $service failed (attempt ${i}/${attempts}), retrying in 5s..." >&2
    sleep 5
    i=$((i + 1))
  done
  return 1
}

# --env-file makes docker compose resolve ${VAR} in docker-compose.yml from
# this file directly, no need to `source` it into the shell first.
for service in $services; do
  pull_with_retry "$service"
done

# Mobile OTA updates and APKs, bind-mounted read-only into pfm-backend
# (docs/ops-runbook.md §8). Created here, as the deploy user, before compose
# touches it: a bind mount whose host directory is missing gets created by
# Docker as root, and the publish scripts (scp as this user) could then
# never write to it.
mkdir -p app-updates

# Apply any pending migrations before anything else touches the database.
# This is the only thing that ever builds or changes the schema: on a brand
# new volume it applies every migration from 001, on an existing one only
# what is pending (cmd/migrate keeps a schema_migrations ledger, one
# transaction per file). Before it existed, a migration added after the
# volume's first boot silently never ran and the new code deployed green
# against a missing table (500 SQLSTATE 42P01) — 009, and later 015-018.
#
# `set -e` (top of this script) plus the workflow's script_stop means a failed
# migration fails the deploy — deliberately, since a half-migrated schema
# should stop the release rather than surface as 500s afterwards.
docker compose --env-file "$ENV_FILE_PATH" run --rm --entrypoint ./migrate pfm-backend

# ⚠️ Migrate runs BEFORE `up -d`, not after. `run` starts pfm-postgres on its
# own and connects with the NEW env file, so a wrong POSTGRES_PASSWORD (the
# volume keeps the password it was initialised with, whatever the env says
# later) or a failing migration stops the deploy while the old backend is
# still serving. Run after `up -d`, the same mistake had already replaced the
# working backend with one that cannot reach the database.

docker compose --env-file "$ENV_FILE_PATH" up -d --remove-orphans

# One-shot bootstrap of the first admin user (see cmd/seed). Runs on every
# deploy but is idempotent — a no-op once the admin row exists, and a no-op
# entirely if SEED_ADMIN_EMAIL/SEED_ADMIN_PASSWORD aren't set in
# $ENV_FILE_PATH. `run --rm` starts a throwaway container on the same
# network/env as pfm-backend without touching the already-running one.
docker compose --env-file "$ENV_FILE_PATH" run --rm --entrypoint ./seed pfm-backend

# Nightly R2 backup + log archive (ops/, docs/ops-runbook.md). Only once the
# backup bucket is configured — otherwise every night would log a failure.
# ops/ is synced by deploy-backend.yml only, hence the existence check.
if [ -f ops/install-cron.sh ]; then
  if env_has BACKUP_R2_BUCKET; then
    bash ops/install-cron.sh
  else
    echo "BACKUP_R2_BUCKET not set — Postgres backups to R2 are NOT scheduled." >&2
  fi
fi

docker image prune -f
