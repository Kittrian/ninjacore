#!/usr/bin/env bash
set -Eeuo pipefail

VERSION="v1.0.0"
CONFIG_FILE="/etc/ninjacore-vps-backup.conf"
LOCK_FILE="/var/lock/ninjacore-vps-backup.lock"

BACKUP_REMOTE="gdrive:NinjaCore-VPS-Backups"
KEEP_BACKUPS=10
HOST_LABEL="$(hostname -s)"
TMP_PARENT="/var/tmp"
LOG_FILE="/var/log/ninjacore-vps-backup.log"

SURREAL_ENDPOINT="http://127.0.0.1:8000"
SURREAL_USER="root"
SURREAL_NS="ninja"
SURREAL_DB="dispute"
SURREAL_PASS_FILE="/etc/ninjacore-vps-backup.surreal-pass"

if [[ -f "$CONFIG_FILE" ]]; then
  # shellcheck source=/dev/null
  source "$CONFIG_FILE"
fi

log() {
  local message="$1"
  printf '[%s] %s\n' "$(date -Is)" "$message" | tee -a "$LOG_FILE"
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || {
    log "ERROR: required command missing: $1"
    exit 1
  }
}

require_rclone_remote() {
  local remote_name="${BACKUP_REMOTE%%:*}:"
  if ! rclone listremotes | grep -Fxq "$remote_name"; then
    log "ERROR: rclone remote missing: $remote_name"
    log "Run: rclone config create ${remote_name%:} drive"
    exit 1
  fi
}

load_surreal_password() {
  if [[ -n "${SURREAL_PASS:-}" ]]; then
    return
  fi

  if [[ ! -f "$SURREAL_PASS_FILE" ]]; then
    log "ERROR: missing SurrealDB password file: $SURREAL_PASS_FILE"
    exit 1
  fi

  SURREAL_PASS="$(<"$SURREAL_PASS_FILE")"
  export SURREAL_PASS
}

run_preflight() {
  require_cmd flock
  require_cmd rclone
  require_cmd surreal
  require_cmd tar
  require_cmd zstd
  require_cmd sha256sum
  require_rclone_remote
  load_surreal_password
  log "Preflight OK for $BACKUP_REMOTE using $SURREAL_ENDPOINT namespace=$SURREAL_NS database=$SURREAL_DB"
}

prune_old_backups() {
  local old_backups
  old_backups="$(
    rclone lsf "$BACKUP_REMOTE" --files-only \
      | grep -E "^${HOST_LABEL}-[0-9]{8}T[0-9]{6}Z\.tar\.zst$" \
      | sort \
      | head -n "-$KEEP_BACKUPS" || true
  )"

  if [[ -z "$old_backups" ]]; then
    log "Retention OK: no old backups to delete"
    return
  fi

  while IFS= read -r backup_name; do
    [[ -z "$backup_name" ]] && continue
    log "Deleting old backup: $backup_name"
    rclone deletefile "$BACKUP_REMOTE/$backup_name"
    rclone deletefile "$BACKUP_REMOTE/$backup_name.sha256" || true
  done <<<"$old_backups"
}

write_metadata() {
  local metadata_dir="$1"
  mkdir -p "$metadata_dir"

  {
    echo "backup_version=$VERSION"
    echo "created_at=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
    echo "host=$(hostname -f 2>/dev/null || hostname)"
    echo "kernel=$(uname -a)"
    echo "backup_remote=$BACKUP_REMOTE"
    echo "surreal_endpoint=$SURREAL_ENDPOINT"
    echo "surreal_namespace=$SURREAL_NS"
    echo "surreal_database=$SURREAL_DB"
    echo "note=SurrealDB live RocksDB files are excluded; logical export is included."
  } >"$metadata_dir/backup-manifest.txt"

  hostnamectl >"$metadata_dir/hostnamectl.txt" 2>&1 || true
  timedatectl >"$metadata_dir/timedatectl.txt" 2>&1 || true
  df -hT >"$metadata_dir/df-hT.txt" 2>&1 || true
  free -h >"$metadata_dir/free-h.txt" 2>&1 || true
  systemctl list-units --type=service --all >"$metadata_dir/systemd-services.txt" 2>&1 || true
  systemctl list-timers --all >"$metadata_dir/systemd-timers.txt" 2>&1 || true
  ps auxww >"$metadata_dir/processes.txt" 2>&1 || true
  dpkg-query -W >"$metadata_dir/packages.txt" 2>&1 || true
  rclone version >"$metadata_dir/rclone-version.txt" 2>&1 || true
  surreal version >"$metadata_dir/surreal-version.txt" 2>&1 || true
}

create_backup() {
  run_preflight

  exec 9>"$LOCK_FILE"
  if ! flock -n 9; then
    log "ERROR: backup already running"
    exit 1
  fi

  local timestamp backup_name stage metadata_dir checksum_file
  timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
  backup_name="${HOST_LABEL}-${timestamp}.tar.zst"
  stage="$(mktemp -d "$TMP_PARENT/ninjacore-vps-backup.XXXXXX")"
  metadata_dir="$stage/backup-metadata"
  checksum_file="$stage/${backup_name}.sha256"

  cleanup() {
    rm -rf "$stage"
  }
  trap cleanup EXIT

  log "Starting backup: $backup_name"
  write_metadata "$metadata_dir"

  log "Exporting SurrealDB safely with logical export"
  surreal export \
    --log none \
    --endpoint "$SURREAL_ENDPOINT" \
    --username "$SURREAL_USER" \
    --password "$SURREAL_PASS" \
    --namespace "$SURREAL_NS" \
    --database "$SURREAL_DB" \
    "$metadata_dir/surrealdb-${SURREAL_NS}-${SURREAL_DB}.surql"

  log "Streaming VPS archive to $BACKUP_REMOTE"
  tar \
    --one-file-system \
    --acls \
    --xattrs \
    --numeric-owner \
    --ignore-failed-read \
    --warning=no-file-changed \
    --exclude='./proc' \
    --exclude='./sys' \
    --exclude='./dev' \
    --exclude='./run' \
    --exclude='./tmp' \
    --exclude='./var/tmp' \
    --exclude='./var/cache' \
    --exclude='./mnt' \
    --exclude='./media' \
    --exclude='./var/lib/surrealdb/ninja.db' \
    --exclude='./var/lib/surrealdb/ninja.db.backup' \
    -C / -cf - . \
    -C "$stage" backup-metadata \
    | zstd -T0 -3 \
    | tee >(sha256sum >"$checksum_file") \
    | rclone rcat "$BACKUP_REMOTE/$backup_name"

  sed -i "s|-|$backup_name|" "$checksum_file"
  rclone copyto "$checksum_file" "$BACKUP_REMOTE/$backup_name.sha256"

  if ! rclone lsf "$BACKUP_REMOTE" --files-only | grep -Fxq "$backup_name"; then
    log "ERROR: uploaded backup not found on remote: $backup_name"
    exit 1
  fi

  prune_old_backups
  log "Backup complete: $backup_name"
}

case "${1:-}" in
  --check)
    run_preflight
    ;;
  --version)
    echo "$VERSION"
    ;;
  *)
    create_backup
    ;;
esac
