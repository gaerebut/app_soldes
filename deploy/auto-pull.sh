#!/usr/bin/env bash
# Auto-deploy for DLC Manager backoffice.
#
# Runs every minute via cron. Fetches the configured branch, and ONLY when
# the remote moved ahead does it pull and restart pm2. Idempotent: a no-op
# when there is nothing to do, so safe at high frequency.
#
# Configurable via environment variables:
#   REPO_DIR   absolute path to the git checkout (default: /root/app_soldes)
#   BRANCH     branch to track (default: claude/remote-backoffice-setup-3E7FN)
#   PM2_NAME   pm2 process name to restart (default: dlc-manager)
#
# Logs go to stdout/stderr — wire them through cron to /var/log/dlc-auto-pull.log.

set -euo pipefail

REPO_DIR="${REPO_DIR:-/root/app_soldes}"
BRANCH="${BRANCH:-claude/remote-backoffice-setup-3E7FN}"
PM2_NAME="${PM2_NAME:-dlc-manager}"
LOCK_FILE="/var/lock/dlc-auto-pull.lock"

log() {
  printf '[%s] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*"
}

# Single-instance: bail immediately if a previous run is still going.
exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  exit 0
fi

cd "$REPO_DIR"

# Refuse to touch a dirty working tree — manual edits on the VPS would be
# silently overwritten otherwise.
if [[ -n "$(git status --porcelain)" ]]; then
  log "skipped: working tree is dirty in $REPO_DIR"
  exit 0
fi

# Fetch quietly. If the network is down we just retry next minute.
if ! git fetch --quiet origin "$BRANCH"; then
  log "skipped: git fetch failed"
  exit 0
fi

local_sha="$(git rev-parse HEAD)"
remote_sha="$(git rev-parse "origin/$BRANCH")"

if [[ "$local_sha" == "$remote_sha" ]]; then
  exit 0   # nothing to do — stay quiet to avoid noisy logs.
fi

log "deploying $BRANCH: $local_sha → $remote_sha"

# Make sure we are actually on the right branch before pulling.
git checkout --quiet "$BRANCH"
git pull --ff-only --quiet origin "$BRANCH"

# Restart the running pm2 process if it exists. Use --update-env so any
# changes to /root/app_soldes/server/.env are picked up.
if command -v pm2 >/dev/null && pm2 describe "$PM2_NAME" >/dev/null 2>&1; then
  if [[ -f "$REPO_DIR/server/.env" ]]; then
    set -a; . "$REPO_DIR/server/.env"; set +a
  fi
  pm2 restart "$PM2_NAME" --update-env --silent
  log "pm2 restarted ($PM2_NAME)"
else
  log "pm2 process '$PM2_NAME' not found — skipped restart"
fi

log "deploy complete"
