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
  mapfile -t pids < <(
    {
      lsof -tiTCP:3000 -sTCP:LISTEN -nP 2>/dev/null
      lsof -tiTCP:3001 -sTCP:LISTEN -nP 2>/dev/null
      lsof -tiTCP:3002 -sTCP:LISTEN -nP 2>/dev/null
      lsof -tiTCP:3555 -sTCP:LISTEN -nP 2>/dev/null
    } | sort -u
  )
  if [[ ${#pids[@]} -eq 0 ]]; then
    exit 0
  fi
  for pid in "${pids[@]}"; do
    kill "$pid" 2>/dev/null || true
  done
  exit 0
fi

cleanup_dev_ports() {
  local ports=(3000 3001 3002 3555)
  local port pid

  for port in "${ports[@]}"; do
    while IFS= read -r pid; do
      [[ -z "$pid" ]] && continue
      kill "$pid" 2>/dev/null || true
    done < <(lsof -tiTCP:"$port" -sTCP:LISTEN -nP 2>/dev/null || true)
  done
}

# Start Wasp full-stack (backend + infra + database)
cd wasp-app
cleanup_dev_ports
export PORT="${PORT:-3555}"
export WASP_SERVER_URL="${WASP_SERVER_URL:-http://192.168.1.17:3555}"
export WASP_WEB_CLIENT_URL="${WASP_WEB_CLIENT_URL:-http://192.168.1.17:3000}"
export REACT_APP_API_URL="${REACT_APP_API_URL:-http://192.168.1.17:3555}"
export NEXT_PUBLIC_API_URL="${NEXT_PUBLIC_API_URL:-http://192.168.1.17:3555}"
export VITE_API_PROXY_TARGET="${VITE_API_PROXY_TARGET:-http://192.168.1.17:3555}"
export SKIP_EMAIL_VERIFICATION_IN_DEV="${SKIP_EMAIL_VERIFICATION_IN_DEV:-true}"
if [[ ! -f .wasp/out/db/schema.prisma ]]; then
  wasp clean
fi
exec wasp start
