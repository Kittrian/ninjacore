#!/bin/zsh
set -euo pipefail

PROJECT_ROOT="${PROJECT_ROOT:-/Users/drewdrew/NinjaTools}"
REMOTE_HOST="${REMOTE_HOST:-5.78.214.176}"
REMOTE_USER="${REMOTE_USER:-root}"
REMOTE_APP_DIR="${REMOTE_APP_DIR:-/home/ninjacore/htdocs/ninjacore.ninjadispute.com}"
REMOTE_PM2_NAME="${REMOTE_PM2_NAME:-ninjacore}"

MODE="${1:-frontend}"
RESTART_AFTER_SYNC="${RESTART_AFTER_SYNC:-0}"
GIT_PUSH_ON_DEPLOY="${GIT_PUSH_ON_DEPLOY:-1}"
GIT_COMMIT_MESSAGE="${GIT_COMMIT_MESSAGE:-Auto deploy ${MODE} $(date '+%Y-%m-%d %H:%M:%S')}"
LOCAL_VERSION_FILE="${PROJECT_ROOT}/public/version.json"
LOCAL_PACKAGE_FILE="${PROJECT_ROOT}/package.json"

normalize_mode() {
  local raw
  raw="$(printf '%s' "$1" | tr '[:upper:]' '[:lower:]')"
  case "${raw}" in
    front) echo "frontend" ;;
    back) echo "backend" ;;
    full) echo "full" ;;
    frontend|backend) echo "${raw}" ;;
    *) echo "${raw}" ;;
  esac
}

MODE="$(normalize_mode "${MODE}")"

if ! command -v sshpass >/dev/null 2>&1; then
  echo "sshpass is required. Install it first, then run this script again."
  exit 1
fi

if ! command -v rsync >/dev/null 2>&1; then
  echo "rsync is required. Install it first, then run this script again."
  exit 1
fi

if [[ -z "${SSH_PASSWORD:-}" ]]; then
  if [[ -t 0 ]]; then
    read -rs "SSH_PASSWORD?Server password for ${REMOTE_USER}@${REMOTE_HOST}: "
    echo
  else
    echo "Missing SSH_PASSWORD environment variable (non-interactive shell)." >&2
    echo "Example: SSH_PASSWORD='your_password' $0 ${MODE}" >&2
    exit 1
  fi
fi

if [[ ! -d "${PROJECT_ROOT}" ]]; then
  echo "Project root not found: ${PROJECT_ROOT}" >&2
  exit 1
fi

sync_file_if_exists() {
  local relative_path="$1"
  local source_path="${PROJECT_ROOT}/${relative_path}"
  if [[ -f "${source_path}" ]]; then
    sshpass -p "${SSH_PASSWORD}" rsync -az \
      -e "ssh -o StrictHostKeyChecking=no" \
      "${source_path}" \
      "${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_APP_DIR}/"
    echo "Synced file: ${relative_path}"
  else
    echo "Skipping missing file: ${relative_path}"
  fi
}

sync_public_file_if_exists() {
  local relative_path="$1"
  local source_path="${PROJECT_ROOT}/${relative_path}"
  if [[ -f "${source_path}" ]]; then
    sshpass -p "${SSH_PASSWORD}" rsync -az \
      -e "ssh -o StrictHostKeyChecking=no" \
      "${source_path}" \
      "${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_APP_DIR}/public/"
    echo "Synced public file: ${relative_path}"
  else
    echo "Skipping missing public file source: ${relative_path}"
  fi
}

sync_dir_if_exists() {
  local relative_path="$1"
  local source_path="${PROJECT_ROOT}/${relative_path}"
  if [[ -d "${source_path}" ]]; then
    sshpass -p "${SSH_PASSWORD}" rsync -az \
      -e "ssh -o StrictHostKeyChecking=no" \
      "${source_path}/" \
      "${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_APP_DIR}/${relative_path}/"
    echo "Synced directory: ${relative_path}/"
  else
    echo "Skipping missing directory: ${relative_path}/"
  fi
}

read_local_frontend_version() {
  if [[ ! -f "${LOCAL_VERSION_FILE}" ]]; then
    echo "Missing local version file: ${LOCAL_VERSION_FILE}" >&2
    exit 1
  fi
  python3 - <<'PY' "${LOCAL_VERSION_FILE}"
import json, sys
path = sys.argv[1]
with open(path, 'r', encoding='utf-8') as fh:
    payload = json.load(fh)
print(str(payload.get('frontendVersion', '')).strip())
PY
}

read_remote_frontend_version() {
  sshpass -p "${SSH_PASSWORD}" ssh -o StrictHostKeyChecking=no "${REMOTE_USER}@${REMOTE_HOST}" \
    "python3 - <<'PY' '${REMOTE_APP_DIR}/public/version.json'\nimport json, sys\npath = sys.argv[1]\ntry:\n    with open(path, 'r', encoding='utf-8') as fh:\n        payload = json.load(fh)\n    print(str(payload.get('frontendVersion', '')).strip())\nexcept FileNotFoundError:\n    print('')\nPY" 2>/dev/null || true
}

read_local_backend_version() {
  if [[ ! -f "${LOCAL_PACKAGE_FILE}" ]]; then
    echo "Missing local package.json: ${LOCAL_PACKAGE_FILE}" >&2
    exit 1
  fi
  python3 - <<'PY' "${LOCAL_PACKAGE_FILE}"
import json, sys
path = sys.argv[1]
with open(path, 'r', encoding='utf-8') as fh:
    payload = json.load(fh)
print(str(payload.get('version', '')).strip())
PY
}

read_remote_backend_version() {
  sshpass -p "${SSH_PASSWORD}" ssh -o StrictHostKeyChecking=no "${REMOTE_USER}@${REMOTE_HOST}" \
    "python3 - <<'PY' '${REMOTE_APP_DIR}/package.json'\nimport json, sys\npath = sys.argv[1]\ntry:\n    with open(path, 'r', encoding='utf-8') as fh:\n        payload = json.load(fh)\n    print(str(payload.get('version', '')).strip())\nexcept FileNotFoundError:\n    print('')\nPY" 2>/dev/null || true
}

version_to_tuple() {
  python3 - <<'PY' "$1"
import re, sys
value = sys.argv[1].strip()
parts = [int(x) for x in re.findall(r'\d+', value)]
if not parts:
    parts = [0]
print('.'.join(map(str, parts)))
PY
}

assert_local_frontend_is_newer() {
  local local_version remote_version local_tuple remote_tuple
  local_version="$(read_local_frontend_version)"
  remote_version="$(read_remote_frontend_version)"

  if [[ -z "${local_version}" ]]; then
    echo "Local frontendVersion is empty in public/version.json" >&2
    exit 1
  fi

  echo "Local frontend version: ${local_version}"
  if [[ -z "${remote_version}" ]]; then
    echo "Remote frontend version: <missing>"
    return 0
  fi

  echo "Remote frontend version: ${remote_version}"
  local_tuple="$(version_to_tuple "${local_version}")"
  remote_tuple="$(version_to_tuple "${remote_version}")"

  python3 - <<'PY' "${local_tuple}" "${remote_tuple}" "${local_version}" "${remote_version}"
import sys
def parse_tuple(value):
    return tuple(int(x) for x in value.split('.') if x != '')
local_tuple = parse_tuple(sys.argv[1])
remote_tuple = parse_tuple(sys.argv[2])
local_version = sys.argv[3]
remote_version = sys.argv[4]
if local_tuple <= remote_tuple:
    print(f"Refusing deploy: local frontend version {local_version} is not newer than remote {remote_version}.", file=sys.stderr)
    sys.exit(1)
PY
}

assert_local_backend_is_newer() {
  local local_version remote_version local_tuple remote_tuple
  local_version="$(read_local_backend_version)"
  remote_version="$(read_remote_backend_version)"

  if [[ -z "${local_version}" ]]; then
    echo "Local backend version is empty in package.json" >&2
    exit 1
  fi

  echo "Local backend version: ${local_version}"
  if [[ -z "${remote_version}" ]]; then
    echo "Remote backend version: <missing>"
    return 0
  fi

  echo "Remote backend version: ${remote_version}"
  local_tuple="$(version_to_tuple "${local_version}")"
  remote_tuple="$(version_to_tuple "${remote_version}")"

  python3 - <<'PY' "${local_tuple}" "${remote_tuple}" "${local_version}" "${remote_version}"
import sys
def parse_tuple(value):
    return tuple(int(x) for x in value.split('.') if x != '')
local_tuple = parse_tuple(sys.argv[1])
remote_tuple = parse_tuple(sys.argv[2])
local_version = sys.argv[3]
remote_version = sys.argv[4]
if local_tuple <= remote_tuple:
    print(f"Refusing deploy: local backend version {local_version} is not newer than remote {remote_version}.", file=sys.stderr)
    sys.exit(1)
PY
}

sync_frontend() {
  echo "Syncing frontend files..."
  assert_local_frontend_is_newer
  # Static frontend is served from ${REMOTE_APP_DIR}/public by server.mjs.
  sshpass -p "${SSH_PASSWORD}" rsync -az \
    -e "ssh -o StrictHostKeyChecking=no" \
    "${PROJECT_ROOT}/public/" \
    "${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_APP_DIR}/public/"
  echo "Synced frontend public/ directory"
}

sync_backend() {
  echo "Syncing backend files..."
  assert_local_backend_is_newer
  sync_file_if_exists "server.mjs"
  sync_file_if_exists "package.json"
  sync_file_if_exists "package-lock.json"
  sync_file_if_exists "ecosystem.config.cjs"
  sync_dir_if_exists "scripts"
}

sync_full() {
  sync_frontend
  sync_backend
}

restart_app() {
  echo "Restarting PM2 app..."
  sshpass -p "${SSH_PASSWORD}" ssh -o StrictHostKeyChecking=no "${REMOTE_USER}@${REMOTE_HOST}" \
    "su - ninjacore -c 'cd ${REMOTE_APP_DIR} && \
      if pm2 describe ${REMOTE_PM2_NAME} >/dev/null 2>&1; then \
        pm2 restart ${REMOTE_PM2_NAME}; \
      else \
        pm2 start ecosystem.config.cjs --only ${REMOTE_PM2_NAME}; \
      fi'"
}

check_health() {
  echo "Checking live health..."
  sshpass -p "${SSH_PASSWORD}" ssh -o StrictHostKeyChecking=no "${REMOTE_USER}@${REMOTE_HOST}" \
    "curl -fsS https://ninjacore.ninjadispute.com/api/health"
  echo
}

verify_live_bundle() {
  echo "Verifying live bundle versions..."

  local remote_index_info
  local remote_app_info
  local remote_version_info
  local live_index_info
  local live_app_info
  local live_version_info

  remote_index_info="$(sshpass -p "${SSH_PASSWORD}" ssh -o StrictHostKeyChecking=no "${REMOTE_USER}@${REMOTE_HOST}" \
    "grep -n 'styles.css?v=\\|app.js?v=' '${REMOTE_APP_DIR}/public/index.html' || true")"
  remote_app_info="$(sshpass -p "${SSH_PASSWORD}" ssh -o StrictHostKeyChecking=no "${REMOTE_USER}@${REMOTE_HOST}" \
    "grep -n \"v[0-9]\\+\\.[0-9]\\+ loaded\" '${REMOTE_APP_DIR}/public/app.js' || true")"
  remote_version_info="$(sshpass -p "${SSH_PASSWORD}" ssh -o StrictHostKeyChecking=no "${REMOTE_USER}@${REMOTE_HOST}" \
    "cat '${REMOTE_APP_DIR}/public/version.json' 2>/dev/null || true")"

  live_index_info="$(curl -fsS --resolve "ninjacore.ninjadispute.com:443:${REMOTE_HOST}" https://ninjacore.ninjadispute.com/ \
    | grep -n 'styles.css?v=\|app.js?v=' || true)"
  live_app_info="$(curl -fsS --resolve "ninjacore.ninjadispute.com:443:${REMOTE_HOST}" https://ninjacore.ninjadispute.com/app.js \
    | grep -n "v[0-9]\\+\\.[0-9]\\+ loaded" || true)"
  live_version_info="$(curl -fsS --resolve "ninjacore.ninjadispute.com:443:${REMOTE_HOST}" https://ninjacore.ninjadispute.com/version.json || true)"

  echo "Remote public/index.html markers:"
  echo "${remote_index_info:-<none found>}"
  echo "Remote public/app.js marker:"
  echo "${remote_app_info:-<none found>}"
  echo "Remote public/version.json:"
  echo "${remote_version_info:-<none found>}"
  echo "Live URL index markers:"
  echo "${live_index_info:-<none found>}"
  echo "Live URL app marker:"
  echo "${live_app_info:-<none found>}"
  echo "Live URL version.json:"
  echo "${live_version_info:-<none found>}"
}

push_github_if_configured() {
  if [[ "${GIT_PUSH_ON_DEPLOY}" != "1" ]]; then
    return 0
  fi

  if ! command -v git >/dev/null 2>&1; then
    echo "Skipping GitHub push: git is not installed."
    return 0
  fi

  if ! git -C "${PROJECT_ROOT}" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    echo "Skipping GitHub push: ${PROJECT_ROOT} is not a git repository."
    return 0
  fi

  if ! git -C "${PROJECT_ROOT}" remote get-url origin >/dev/null 2>&1; then
    echo "Skipping GitHub push: git remote 'origin' is not configured."
    return 0
  fi

  local branch
  branch="$(git -C "${PROJECT_ROOT}" rev-parse --abbrev-ref HEAD 2>/dev/null || true)"
  if [[ -z "${branch}" || "${branch}" == "HEAD" ]]; then
    echo "Skipping GitHub push: could not determine active branch."
    return 0
  fi

  if [[ -n "$(git -C "${PROJECT_ROOT}" status --porcelain)" ]]; then
    echo "Creating deploy commit for GitHub..."
    git -C "${PROJECT_ROOT}" add -A
    git -C "${PROJECT_ROOT}" commit -m "${GIT_COMMIT_MESSAGE}" || true
  fi

  echo "Pushing to GitHub (origin/${branch})..."
  git -C "${PROJECT_ROOT}" push origin "${branch}"
}

case "${MODE}" in
  frontend)
    sync_frontend
    ;;
  backend)
    sync_backend
    RESTART_AFTER_SYNC=1
    ;;
  full)
    sync_full
    RESTART_AFTER_SYNC=1
    ;;
  *)
    echo "Usage: $0 [frontend|backend|full|front|back]"
    exit 1
    ;;
esac

if [[ "${RESTART_AFTER_SYNC}" == "1" ]]; then
  restart_app
fi

check_health
verify_live_bundle
push_github_if_configured
echo "Deploy complete."
