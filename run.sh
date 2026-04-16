#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

usage() {
  cat <<'EOF'
Usage:
  ./run.sh             Start full local project (infra + backend + frontend)
  ./run.sh --stop      Stop processes started by run.sh/dev-up.sh
  ./run.sh --help      Show this help

Any other flags are forwarded to ./scripts/dev-up.sh.
Examples:
  ./run.sh --backend-port 3001 --frontend-port 3000
  ./run.sh --no-docker
EOF
}

if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
  usage
  exit 0
fi

if [[ "${1:-}" == "--stop" ]]; then
  exec bash ./scripts/dev-up.sh --stop
fi

exec bash ./scripts/dev-up.sh "$@"
