#!/usr/bin/env bash
# Shared helpers for the ops scripts (backup-postgres.sh, archive-logs.sh).
# Sourced, never executed. See docs/ops-runbook.md.

OPS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(dirname "$OPS_DIR")"
ENV_FILE_PATH="${ENV_FILE_PATH:-$APP_DIR/.env.prod}"

POSTGRES_CONTAINER="pfm-postgres-container"
CONTAINER_NAME_PREFIX="pfm-"
# rclone never ages out the way cloudflared does, so this one is pinned.
RCLONE_IMAGE="rclone/rclone:1.68.2"

BACKUP_PREFIX="postgres"
LOG_NORMAL_PREFIX="logs/normal"
LOG_SEVERE_PREFIX="logs/severe"
BACKUP_RETENTION_DAYS=30
LOG_NORMAL_RETENTION_DAYS=30
LOG_SEVERE_RETENTION_DAYS=60

log() { printf '%s %s\n' "$(date -u +%FT%TZ)" "$*"; }

# env_get KEY — one value from the env file, without sourcing it: a sourced
# .env.prod would execute any shell syntax a secret happens to contain.
env_get() {
  local line
  line="$(grep -E "^[[:space:]]*$1=" "$ENV_FILE_PATH" | tail -n 1 || true)"
  line="${line#*=}"
  line="${line%$'\r'}"
  line="${line%\"}"
  printf '%s' "${line#\"}"
}

require_env() {
  local missing=""
  for key in "$@"; do
    [ -n "$(env_get "$key")" ] || missing="$missing $key"
  done
  if [ -n "$missing" ]; then
    log "FAILED: missing in $ENV_FILE_PATH:$missing" >&2
    exit 1
  fi
}

# ops_init — a private work dir plus an rclone env file (mode 600), both
# removed on exit. Credentials go in through --env-file, never as `-e K=V`
# arguments, which any local user could read from `ps`.
ops_init() {
  require_env BACKUP_R2_ACCESS_KEY_ID BACKUP_R2_SECRET_ACCESS_KEY BACKUP_R2_BUCKET
  local account bucket
  account="$(env_get BACKUP_R2_ACCOUNT_ID)"
  [ -n "$account" ] || account="$(env_get R2_ACCOUNT_ID)"
  bucket="$(env_get BACKUP_R2_BUCKET)"
  if [ -z "$account" ]; then
    log "FAILED: set BACKUP_R2_ACCOUNT_ID (or R2_ACCOUNT_ID)" >&2
    exit 1
  fi
  # ⚠️ The icon bucket is public (R2_PUBLIC_BASE_URL). A database dump there
  # would be downloadable by anyone who guesses its name.
  if [ "$bucket" = "$(env_get R2_BUCKET)" ]; then
    log "FAILED: BACKUP_R2_BUCKET must be a private bucket, not the public icon bucket" >&2
    exit 1
  fi

  WORK_DIR="$(mktemp -d)"
  RCLONE_ENV="$WORK_DIR/.rclone.env"
  trap 'rm -rf "$WORK_DIR"' EXIT
  umask 077
  cat > "$RCLONE_ENV" <<EOF
RCLONE_CONFIG_R2_TYPE=s3
RCLONE_CONFIG_R2_PROVIDER=Cloudflare
RCLONE_CONFIG_R2_ACCESS_KEY_ID=$(env_get BACKUP_R2_ACCESS_KEY_ID)
RCLONE_CONFIG_R2_SECRET_ACCESS_KEY=$(env_get BACKUP_R2_SECRET_ACCESS_KEY)
RCLONE_CONFIG_R2_ENDPOINT=https://${account}.r2.cloudflarestorage.com
RCLONE_CONFIG_R2_NO_CHECK_BUCKET=true
EOF
  R2_TARGET="r2:$bucket"
}

# r2 ARGS… — rclone in a throwaway container; WORK_DIR is /data inside it.
r2() {
  docker run --rm --env-file "$RCLONE_ENV" -v "$WORK_DIR:/data" "$RCLONE_IMAGE" "$@"
}
