#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WASP_DIR="$ROOT_DIR/wasp-app"

usage() {
  cat <<'EOF'
Usage:
  ./run.sh            Start Docker infra + Wasp dev stack
  ./run.sh --stop     Stop Docker infra and local dev processes
  ./run.sh --help     Show this help

Starts:
  - PostgreSQL (5432)
  - Redis (6379)
  - MinIO (9000/9001)
  - Wasp app (backend 3555, frontend 3000)
EOF
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "Missing required command: $1" >&2
    exit 1
  }
}

wait_for_container_health() {
  local container_name="$1"
  local timeout_seconds="${2:-120}"
  local elapsed=0
  local status=""

  while (( elapsed < timeout_seconds )); do
    status="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$container_name" 2>/dev/null || true)"
    case "$status" in
      healthy)
        return 0
        ;;
      running|starting)
        sleep 2
        elapsed=$((elapsed + 2))
        ;;
      "")
        sleep 2
        elapsed=$((elapsed + 2))
        ;;
      unhealthy)
        echo "Container $container_name reported unhealthy" >&2
        return 1
        ;;
      *)
        sleep 2
        elapsed=$((elapsed + 2))
        ;;
    esac
  done

  echo "Timed out waiting for $container_name to become healthy" >&2
  return 1
}

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

start_infra() {
  docker compose up -d postgres redis minio
  wait_for_container_health vibescan-postgres 120
  wait_for_container_health vibescan-redis 120
  wait_for_container_health vibescan-minio 120
}

stop_all() {
  cleanup_dev_ports
  if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
    docker compose down --remove-orphans >/dev/null 2>&1 || true
  fi
}

detect_server_ip() {
  local server_ip
  server_ip="$(hostname -I 2>/dev/null | awk '{print $1}')"
  if [[ -z "${server_ip:-}" ]]; then
    server_ip="127.0.0.1"
  fi
  printf '%s' "$server_ip"
}

start_wasp() {
  cd "$WASP_DIR"
  local server_ip
  server_ip="$(detect_server_ip)"

  export PORT="${PORT:-3555}"
  export WASP_SERVER_URL="${WASP_SERVER_URL:-http://${server_ip}:3555}"
  export WASP_WEB_CLIENT_URL="${WASP_WEB_CLIENT_URL:-http://${server_ip}:3000}"
  export REACT_APP_API_URL="${REACT_APP_API_URL:-http://${server_ip}:3000}"
  export NEXT_PUBLIC_API_URL="${NEXT_PUBLIC_API_URL:-http://${server_ip}:3000}"
  export VITE_API_PROXY_TARGET="${VITE_API_PROXY_TARGET:-http://${server_ip}:3555}"
  export SKIP_EMAIL_VERIFICATION_IN_DEV="${SKIP_EMAIL_VERIFICATION_IN_DEV:-true}"

  if [[ ! -f .wasp/out/db/schema.prisma ]]; then
    wasp clean
  fi

  exec wasp start
}

main() {
  if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
    usage
    exit 0
  fi

  if [[ "${1:-}" == "--stop" ]]; then
    stop_all
    exit 0
  fi

  require_cmd docker
  require_cmd wasp
  require_cmd lsof
  require_cmd awk
  require_cmd hostname

  cleanup_dev_ports
  start_infra
  start_wasp
}

main "$@"
