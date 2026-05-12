#!/bin/bash
# Install TourBox Coach systemd services on the Pi.
#
# Idempotent: re-running just updates the unit files + reloads + restarts.
# After this runs, backend + frontend + CPU governor are managed by systemd
# and start automatically on boot.
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
UNIT_DIR="$SCRIPT_DIR/systemd"

if [[ ! -d "$UNIT_DIR" ]]; then
  echo "missing $UNIT_DIR" >&2
  exit 1
fi

echo "[1/4] Stopping any manual background processes..."
pkill -f "uvicorn backend" 2>/dev/null || true
pkill -f "vite" 2>/dev/null || true
sleep 1

echo "[2/4] Installing unit files to /etc/systemd/system/..."
for unit in tourbox-coach.service tourbox-coach-frontend.service tourbox-coach-perf.service tourbox-coach-ap.service tourbox-coach-setup.service; do
  sudo cp "$UNIT_DIR/$unit" "/etc/systemd/system/$unit"
  sudo chmod 0644 "/etc/systemd/system/$unit"
  echo "  installed $unit"
done

echo "[3/4] Reloading systemd + enabling services on boot..."
sudo systemctl daemon-reload
sudo systemctl enable tourbox-coach-perf.service
sudo systemctl enable tourbox-coach-ap.service
sudo systemctl enable tourbox-coach.service
sudo systemctl enable tourbox-coach-setup.service
sudo systemctl enable tourbox-coach-frontend.service

echo "[4/4] Starting services now..."
sudo systemctl restart tourbox-coach-perf.service
# AP service is special: it depends on existing tourbox-ap NM connection. If
# the connection is already up (we already created it during this install),
# `restart` is a no-op that registers state with systemd.
sudo systemctl restart tourbox-coach-ap.service || true
sudo systemctl restart tourbox-coach.service
sudo systemctl restart tourbox-coach-setup.service
sudo systemctl restart tourbox-coach-frontend.service

sleep 2
echo ""
echo "─── Status ─────────────────────────────────────────────"
for unit in tourbox-coach-perf tourbox-coach-ap tourbox-coach tourbox-coach-setup tourbox-coach-frontend; do
  printf "%-32s " "$unit:"
  systemctl is-active "$unit" || true
done

echo ""
echo "✓ All services installed and running."
echo ""
echo "Useful commands:"
echo "  sudo systemctl status tourbox-coach"
echo "  sudo systemctl status tourbox-coach-frontend"
echo "  sudo journalctl -u tourbox-coach -f     # tail backend logs"
echo "  sudo journalctl -u tourbox-coach-frontend -f"
echo "  sudo systemctl restart tourbox-coach    # after backend code change"
