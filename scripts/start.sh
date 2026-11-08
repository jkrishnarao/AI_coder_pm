#!/usr/bin/env sh
set -eu

project_root="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
cd "$project_root"
docker compose up --build -d
port="${PM_PORT:-8000}"
printf 'Project Management MVP is starting at http://localhost:%s\n' "$port"