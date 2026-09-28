#!/usr/bin/env bash
# Nightly Postgres backup to a private R2 bucket, kept for
# BACKUP_RETENTION_DAYS. Run by cron (installed by deploy.sh via
# install-cron.sh); safe to run by hand. Restore: docs/ops-runbook.md.
set -euo pipefail
. "$(dirname "$0")/lib.sh"

trap 'log "FAILED: postgres backup did not complete" >&2' ERR
require_env POSTGRES_USER POSTGRES_DB
ops_init

file="pfm-$(date -u +%Y%m%dT%H%M%SZ).dump"

# Custom format: compressed, and pg_restore can restore single tables from it.
docker exec "$POSTGRES_CONTAINER" pg_dump \
  -U "$(env_get POSTGRES_USER)" -d "$(env_get POSTGRES_DB)" \
  --format=custom --no-owner > "$WORK_DIR/$file"

# A dump pg_restore can list is complete; a truncated one fails here, before
# anything is uploaded or any old backup is deleted.
docker exec -i "$POSTGRES_CONTAINER" pg_restore --list < "$WORK_DIR/$file" > /dev/null

r2 copyto "/data/$file" "$R2_TARGET/$BACKUP_PREFIX/$file"

# Retention runs only after a successful upload (set -e), so a broken night
# never eats into the backups that still exist.
r2 delete "$R2_TARGET/$BACKUP_PREFIX" --min-age "${BACKUP_RETENTION_DAYS}d"

log "backup ok: $BACKUP_PREFIX/$file ($(du -h "$WORK_DIR/$file" | cut -f1))"
