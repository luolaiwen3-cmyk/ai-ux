#!/bin/sh
set -eu

REPO_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)

cleanup() {
  kill "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

cd "$REPO_DIR/backend"
UV_CACHE_DIR="$REPO_DIR/.uv-cache" uv run uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload &
BACKEND_PID=$!

cd "$REPO_DIR/frontend"
npm run dev -- --host 127.0.0.1 &
FRONTEND_PID=$!

wait "$BACKEND_PID" "$FRONTEND_PID"
