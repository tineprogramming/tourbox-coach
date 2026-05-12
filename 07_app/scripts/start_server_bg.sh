#!/bin/bash
# Start uvicorn detached from the SSH session. Truly background — closes all
# FDs, uses setsid so it survives shell exit. Idempotent: kills any existing
# uvicorn before starting.
set -e
cd "$HOME/tourbox-coach"
pkill -f "uvicorn backend" 2>/dev/null || true
sleep 1
source venv/bin/activate
setsid uvicorn backend.main:app --host 0.0.0.0 --port 8000 \
  </dev/null >/tmp/uvicorn.log 2>&1 &
disown $!
echo "started pid=$!"
