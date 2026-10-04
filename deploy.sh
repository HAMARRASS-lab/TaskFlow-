#!/usr/bin/env bash
# Deploy TaskFlow to a fresh Ubuntu/Debian server over SSH.
#   ./deploy.sh <server-ip> [ssh-user]
# Installs Docker on first run, syncs the repo, keeps secrets in /opt/taskflow/.env
# (generated once on the server, never overwritten) and rebuilds the stack.
set -euo pipefail

HOST="${1:?usage: ./deploy.sh <server-ip> [ssh-user]}"
USER_NAME="${2:-root}"
TARGET="$USER_NAME@$HOST"
APP_DIR=/opt/taskflow

cd "$(dirname "$0")"

echo "==> Installing Docker (if needed)"
ssh "$TARGET" 'command -v docker >/dev/null || curl -fsSL https://get.docker.com | sh'

echo "==> Syncing code to $APP_DIR"
ssh "$TARGET" "mkdir -p $APP_DIR"
rsync -az --delete \
  --exclude .git --exclude .idea --exclude .env \
  --exclude backend/target --exclude frontend/node_modules --exclude frontend/dist \
  --exclude frontend/.angular --exclude frontend/coverage --exclude 'frontend/cypress/videos' \
  --exclude 'frontend/cypress/screenshots' \
  ./ "$TARGET:$APP_DIR/"

echo "==> Creating secrets (first deploy only)"
ssh "$TARGET" "cd $APP_DIR && [ -f .env ] || { umask 077; printf 'DB_PASSWORD=%s\nJWT_SECRET=%s\n' \"\$(openssl rand -hex 24)\" \"\$(openssl rand -base64 48 | tr -d '\n')\" > .env; }"

echo "==> Building and starting containers"
ssh "$TARGET" "cd $APP_DIR && docker compose -f docker-compose.prod.yml up -d --build --remove-orphans && docker image prune -f >/dev/null"

echo "==> Done: http://$HOST"
