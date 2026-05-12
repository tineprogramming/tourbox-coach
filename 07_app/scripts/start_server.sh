#!/bin/bash
# Start FastAPI dev server on Pi (port 8000, reload on change).
set -e
cd "$HOME/tourbox-coach"
source venv/bin/activate
exec uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
