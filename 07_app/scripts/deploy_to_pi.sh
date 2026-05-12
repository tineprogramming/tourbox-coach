#!/bin/bash
# Deploy local 07_app/ → Pi at ~/tourbox-coach/.
# Run from repo root (or anywhere — uses absolute paths).
set -e

PI_HOST="${PI_HOST:-tourbox@10.10.1.116}"
LOCAL_DIR="$(cd "$(dirname "$0")/.." && pwd)"
REMOTE_DIR="\$HOME/tourbox-coach"

echo "[deploy] $LOCAL_DIR/  →  $PI_HOST:$REMOTE_DIR/"

rsync -av --delete \
  --exclude '__pycache__' \
  --exclude '*.pyc' \
  --exclude 'venv' \
  --exclude 'sessions' \
  --exclude 'node_modules' \
  --exclude 'dist' \
  --exclude '.DS_Store' \
  --exclude '.env' \
  --exclude '.env.*' \
  "$LOCAL_DIR/backend" \
  "$LOCAL_DIR/scripts" \
  "$LOCAL_DIR/frontend" \
  "$PI_HOST:$REMOTE_DIR/"

echo "[deploy] sync done"

# Restart the backend service if systemd is managing it. Frontend Vite has
# HMR, so it picks up source changes without a restart. The backend (Python)
# does not auto-reload.
if ssh -o BatchMode=yes "$PI_HOST" 'systemctl is-enabled tourbox-coach.service' >/dev/null 2>&1; then
  echo "[deploy] restarting tourbox-coach (systemd)..."
  ssh "$PI_HOST" 'sudo systemctl restart tourbox-coach.service && sleep 1 && systemctl is-active tourbox-coach.service'
else
  echo "[deploy] systemd not yet installed — run scripts/install_systemd.sh on Pi to enable autostart."
  echo "[deploy] (you may need to restart uvicorn manually via scripts/start_server_bg.sh)"
fi
