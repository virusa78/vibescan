#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

usage() {
  cat <<'EOF'
Usage:
  ./run.sh             Start full local project (Wasp backend + infra)
  ./run.sh --stop      Stop processes started by run.sh
  ./run.sh --help      Show this help

Backend runs on port 3555 (Wasp)
Database: PostgreSQL 5432
Cache: Redis 6379
Storage: MinIO 9000
EOF
}

if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
  usage
  exit 0
fi

if [[ "${1:-}" == "--stop" ]]; then
  exec bash ./scripts/wasp-dev.sh down
fi

# Start Wasp full-stack (backend + infra + database)
cd wasp-app
export PORT="${PORT:-3555}"
exec wasp start
