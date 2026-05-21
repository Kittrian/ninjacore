#!/bin/zsh
set -euo pipefail

PROJECT_ROOT="/Users/drewdrew/NinjaTools"

cd "${PROJECT_ROOT}"

if [[ -z "${SSH_PASSWORD:-}" ]]; then
  echo "Missing SSH_PASSWORD environment variable."
  echo "Usage: SSH_PASSWORD='your_server_password' ./scripts/push-live-frontend.sh"
  exit 1
fi

./scripts/deploy-live.sh frontend
