#!/usr/bin/env bash
# Installs (or refreshes) the ops cron jobs in the current user's crontab.
# Idempotent: the managed block is replaced whole on every run, so
# deploy.sh can call this on every deploy. Output goes to syslog/journald
# (`journalctl -t pfm-backup -t pfm-logs`).
set -euo pipefail

OPS_DIR="$(cd "$(dirname "$0")" && pwd)"
BEGIN_MARK="# >>> pfm-ops (managed by deploy.sh, do not edit) >>>"
END_MARK="# <<< pfm-ops <<<"

# Times assume the VPS clock is UTC (cloud-image default; check with
# `timedatectl`). Debian/Ubuntu cron has no CRON_TZ, so it cannot be forced
# here. 19:00 UTC is 02:00 in Vietnam, the quietest hour; logs for the
# previous UTC day are archived shortly after it closes.
BACKUP_SCHEDULE="0 19 * * *"
LOG_ARCHIVE_SCHEDULE="20 0 * * *"

chmod +x "$OPS_DIR"/*.sh

{
  crontab -l 2>/dev/null | sed "/^${BEGIN_MARK}\$/,/^${END_MARK}\$/d" || true
  echo "$BEGIN_MARK"
  echo "$BACKUP_SCHEDULE $OPS_DIR/backup-postgres.sh 2>&1 | logger -t pfm-backup"
  echo "$LOG_ARCHIVE_SCHEDULE $OPS_DIR/archive-logs.sh 2>&1 | logger -t pfm-logs"
  echo "$END_MARK"
} | crontab -

echo "pfm-ops cron installed:"
crontab -l | sed -n "/^${BEGIN_MARK}\$/,/^${END_MARK}\$/p"
