#!/usr/bin/env bash
# Ships one UTC day of every pfm-* container's logs to R2 and applies
# retention: the full log for LOG_NORMAL_RETENTION_DAYS, the severe lines for
# LOG_SEVERE_RETENTION_DAYS. Local Docker logs are only size-capped
# (docker-compose.yml x-logging), so this is where age-based retention lives.
#
#   archive-logs.sh              # yesterday (what cron runs)
#   archive-logs.sh 2026-09-27   # a specific day
set -euo pipefail
. "$(dirname "$0")/lib.sh"

trap 'log "FAILED: log archive did not complete" >&2' ERR
ops_init

day="${1:-$(date -u -d yesterday +%F)}"
since="${day}T00:00:00Z"
until="$(date -u -d "$day + 1 day" +%F)T00:00:00Z"

# Severe = error and above, across every format these containers write: zap
# JSON ("level":"error"), the ai-service JSON ("level": "ERROR"), uvicorn and
# Postgres prefixes, cloudflared's "ERR", and Go panics with their goroutine
# header. Case-sensitive on purpose — "error_type" in a warning is not severe.
SEVERE_PATTERN='"level": ?"(error|dpanic|panic|fatal|ERROR|CRITICAL)"|(^|[[:space:]])(ERROR|FATAL|PANIC|CRITICAL|ERR)[:[:space:]]|panic:|^[^ ]+ goroutine [0-9]+ \['

containers="$(docker ps -a --format '{{.Names}}' --filter "name=^${CONTAINER_NAME_PREFIX}")"
for container in $containers; do
  normal="$WORK_DIR/$container.log"
  severe="$WORK_DIR/$container.severe.log"
  docker logs --timestamps --since "$since" --until "$until" "$container" > "$normal" 2>&1
  [ -s "$normal" ] || continue
  grep -E "$SEVERE_PATTERN" "$normal" > "$severe" || true

  gzip -f "$normal"
  r2 copyto "/data/$container.log.gz" "$R2_TARGET/$LOG_NORMAL_PREFIX/$day/$container.log.gz"
  if [ -s "$severe" ]; then
    gzip -f "$severe"
    r2 copyto "/data/$container.severe.log.gz" "$R2_TARGET/$LOG_SEVERE_PREFIX/$day/$container.log.gz"
  fi
done

r2 delete "$R2_TARGET/$LOG_NORMAL_PREFIX" --min-age "${LOG_NORMAL_RETENTION_DAYS}d"
r2 delete "$R2_TARGET/$LOG_SEVERE_PREFIX" --min-age "${LOG_SEVERE_RETENTION_DAYS}d"
r2 rmdirs "$R2_TARGET/logs" --leave-root || true

log "log archive ok: $day"
