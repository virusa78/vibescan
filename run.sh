#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WASP_DIR="$ROOT_DIR/wasp-app"
LOG_DIR="$ROOT_DIR/.logs"
SCANNER_TOOLS_BIN="$ROOT_DIR/.tools/bin"
DEV_LOG_FILE="$LOG_DIR/wasp-dev.log"
DEV_LOG_MAX_BYTES=$((200 * 1024))

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

ensure_log_dir() {
  mkdir -p "$LOG_DIR"
}

archive_dev_log() {
  local reason="$1"
  local archive_date="${2:-$(date +%F)}"
  local timestamp
  timestamp="$(date +%Y%m%d-%H%M%S)"
  local archived_file="$LOG_DIR/wasp-dev-${archive_date}-${reason}-${timestamp}.log"

  if [[ -f "$DEV_LOG_FILE" && -s "$DEV_LOG_FILE" ]]; then
    mv "$DEV_LOG_FILE" "$archived_file"
  fi
}

current_log_size() {
  if [[ -f "$DEV_LOG_FILE" ]]; then
    wc -c < "$DEV_LOG_FILE" 2>/dev/null || echo 0
  else
    echo 0
  fi
}

rotate_dev_log_if_needed() {
  ensure_log_dir

  local current_date
  current_date="$(date +%F)"
  local marker_file="$LOG_DIR/wasp-dev.current-date"
  local previous_date=""

  if [[ -f "$marker_file" ]]; then
    previous_date="$(cat "$marker_file" 2>/dev/null || true)"
  fi

  if [[ -f "$DEV_LOG_FILE" && -n "$previous_date" && "$previous_date" != "$current_date" ]]; then
    archive_dev_log "day" "$previous_date"
  fi

  printf '%s' "$current_date" > "$marker_file"
  if (( $(current_log_size) > DEV_LOG_MAX_BYTES )); then
    archive_dev_log "size"
  fi
}

write_rotating_dev_log() {
  ensure_log_dir
  local marker_file="$LOG_DIR/wasp-dev.current-date"
  local current_date=""
  local line
  local announced_wasp=0
  local announced_vite=0
  local announced_backend=0

  while IFS= read -r line || [[ -n "$line" ]]; do
    current_date="$(date +%F)"
    local previous_date=""
    if [[ -f "$marker_file" ]]; then
      previous_date="$(cat "$marker_file" 2>/dev/null || true)"
    fi

    if [[ "$previous_date" != "$current_date" ]]; then
      printf '%s' "$current_date" > "$marker_file"
      if [[ -n "$previous_date" ]]; then
        archive_dev_log "day" "$previous_date"
      fi
    fi

    local line_size
    line_size=${#line}
    local current_size
    current_size="$(current_log_size)"
    if (( current_size + line_size + 1 > DEV_LOG_MAX_BYTES )); then
      archive_dev_log "size"
    fi

    printf '%s\n' "$line" >> "$DEV_LOG_FILE"

    if (( announced_wasp == 0 )) && [[ "$line" == *"🐝 --- Listening for file changes"* ]]; then
      echo "[run.sh] WASP запущен"
      announced_wasp=1
    fi

    if (( announced_vite == 0 )) && [[ "$line" == *"[ Client ]   ➜  Local:"* ]]; then
      echo "[run.sh] Vite запущен: http://localhost:3000"
      announced_vite=1
    fi

    if (( announced_backend == 0 )) && [[ "$line" == *"auth initialized"* ]]; then
      echo "[run.sh] Backend запущен: http://127.0.0.1:${PORT:-3555}"
      announced_backend=1
    fi
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

  export PATH="$SCANNER_TOOLS_BIN:$PATH"
  export OWASP_DATA_DIRECTORY="${OWASP_DATA_DIRECTORY:-$WASP_DIR/.cache/owasp/data}"
  export PORT="${PORT:-3555}"
  export WASP_SERVER_URL="${WASP_SERVER_URL:-http://${server_ip}:3555}"
  export WASP_WEB_CLIENT_URL="${WASP_WEB_CLIENT_URL:-http://${server_ip}:3000}"
  export REACT_APP_API_URL="${REACT_APP_API_URL:-http://${server_ip}:3000}"
  export NEXT_PUBLIC_API_URL="${NEXT_PUBLIC_API_URL:-http://${server_ip}:3000}"
  export VITE_API_PROXY_TARGET="${VITE_API_PROXY_TARGET:-http://${server_ip}:3555}"
  export SKIP_EMAIL_VERIFICATION_IN_DEV="${SKIP_EMAIL_VERIFICATION_IN_DEV:-true}"

  rotate_dev_log_if_needed

  echo "[run.sh] Запускаю Wasp. Подробные логи: $DEV_LOG_FILE"
  echo "[run.sh] Ожидание статусов запуска (WASP / Vite / Backend)..."

  if [[ ! -f .wasp/out/db/schema.prisma ]]; then
    wasp clean
  fi

  wasp start 2>&1 | write_rotating_dev_log
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
