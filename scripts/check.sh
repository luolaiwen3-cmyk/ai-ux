#!/bin/sh
set -eu

REPO_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$REPO_DIR/backend"
UV_CACHE_DIR="$REPO_DIR/.uv-cache" uv run pytest
UV_CACHE_DIR="$REPO_DIR/.uv-cache" uv run alembic upgrade head
cd "$REPO_DIR/frontend"
npm run build
