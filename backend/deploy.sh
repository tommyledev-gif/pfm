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

# --env-file makes docker compose resolve ${VAR} in docker-compose.yml from
# this file directly, no need to `source` it into the shell first.
docker compose --env-file "$ENV_FILE_PATH" pull
docker compose --env-file "$ENV_FILE_PATH" up -d --remove-orphans
docker image prune -f
