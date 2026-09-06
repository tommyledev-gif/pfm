#!/usr/bin/env bash
# Pulls the freshly-pushed backend image and (re)starts the stack on the VPS.
# Invoked over SSH by .github/workflows/deploy-backend.yml after
# docker-compose.yml + deploy.sh + db/migrations/*.sql are synced.
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
for service in pfm-postgres pfm-backend ai-service; do
  pull_with_retry "$service"
done
docker compose --env-file "$ENV_FILE_PATH" up -d --remove-orphans

# Apply any pending migrations before anything else touches the database.
#
# docker-entrypoint-initdb.d (the migration mounts in docker-compose.yml) only
# fires once, when the volume is first initialized — so on every existing
# environment it does nothing at all. Without this step, a migration added
# after that first boot silently never ran, and the new code deployed green
# against a schema missing its table (500 SQLSTATE 42P01 at runtime). That
# happened to 009_notifications and again, in production, to 015-018. CI can't
# catch it: it compiles Go and runs unit tests against in-memory fakes, never
# Postgres.
#
# cmd/migrate keeps a schema_migrations ledger and applies only what's
# pending, each file in its own transaction. `set -e` (top of this script)
# plus the workflow's script_stop means a failed migration fails the deploy —
# deliberately, since a half-migrated schema should stop the release rather
# than surface as 500s afterwards.
#
# No operator step is needed to adopt an existing environment: on its first
# run against a database that already has the schema but no ledger (every
# environment built by docker-entrypoint-initdb.d), the runner records each
# migration whose objects already exist instead of failing on it, and applies
# only the genuinely missing ones. Adoption is allowed on that first run
# only — afterwards a duplicate-object error is a real failure.
docker compose --env-file "$ENV_FILE_PATH" run --rm --entrypoint ./migrate pfm-backend

# One-shot bootstrap of the first admin user (see cmd/seed). Runs on every
# deploy but is idempotent — a no-op once the admin row exists, and a no-op
# entirely if SEED_ADMIN_EMAIL/SEED_ADMIN_PASSWORD aren't set in
# $ENV_FILE_PATH. `run --rm` starts a throwaway container on the same
# network/env as pfm-backend without touching the already-running one.
docker compose --env-file "$ENV_FILE_PATH" run --rm --entrypoint ./seed pfm-backend

docker image prune -f
