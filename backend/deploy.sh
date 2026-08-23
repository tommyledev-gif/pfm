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

# One-shot bootstrap of the first admin user (see cmd/seed). Runs on every
# deploy but is idempotent — a no-op once the admin row exists, and a no-op
# entirely if SEED_ADMIN_EMAIL/SEED_ADMIN_PASSWORD aren't set in
# $ENV_FILE_PATH. `run --rm` starts a throwaway container on the same
# network/env as pfm-backend without touching the already-running one.
docker compose --env-file "$ENV_FILE_PATH" run --rm --entrypoint ./seed pfm-backend

docker image prune -f
