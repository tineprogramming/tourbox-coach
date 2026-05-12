#!/bin/bash
# Start Vite dev server detached from SSH session.
# Idempotent: kills existing vite first.
set -e
cd "$HOME/tourbox-coach/frontend"
pkill -f "vite" 2>/dev/null || true
sleep 1
setsid npm run dev </dev/null >/tmp/vite.log 2>&1 &
disown $!
echo "started vite pid=$!"
