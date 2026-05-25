#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WASP_DIR="$ROOT_DIR/wasp-app"
LOG_DIR="$ROOT_DIR/.logs"
SCANNER_TOOLS_BIN="$ROOT_DIR/.tools/bin"
DEV_LOG_FILE="$LOG_DIR/wasp-dev.log"
DEV_LOG_MAX_BYTES=$((200 * 1024))
DEFAULT_DB_PORT=5432
FALLBACK_DB_PORT=5444
POSTGRES_CONTAINER_NAME="vibescan-postgres"

usage() {
  cat <<'EOF'
Usage:
  ./run.sh            Start Docker infra + Wasp dev stack
  ./run.sh --stop     Stop Docker infra and local dev processes
  ./run.sh --help     Show this help

Starts:
  - PostgreSQL (5432 or fallback 5444)
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

is_port_free() {
  local port="$1"
  if docker ps --format '{{.Ports}}' | grep -Fq ":${port}->"; then
    return 1
  fi

  ! lsof -tiTCP:"$port" -sTCP:LISTEN -nP >/dev/null 2>&1
}

managed_postgres_port() {
  local host_port=""

  host_port="$(
    docker inspect \
      --format '{{with (index .NetworkSettings.Ports "5432/tcp")}}{{(index . 0).HostPort}}{{end}}' \
      "$POSTGRES_CONTAINER_NAME" 2>/dev/null || true
  )"

  if [[ -n "$host_port" ]]; then
    printf '%s' "$host_port"
  fi
}

managed_postgres_is_running() {
  local running=""

  running="$(docker inspect --format '{{.State.Running}}' "$POSTGRES_CONTAINER_NAME" 2>/dev/null || true)"
  [[ "$running" == "true" ]]
}

choose_free_port() {
  local preferred_port="$1"
  local max_attempts="${2:-20}"
  local candidate="$preferred_port"
  local attempts=0

  while (( attempts < max_attempts )); do
    if is_port_free "$candidate"; then
      printf '%s' "$candidate"
      return 0
    fi

    candidate=$((candidate + 1))
    attempts=$((attempts + 1))
  done

  echo "Unable to find a free port starting from ${preferred_port}" >&2
  return 1
}

tail_log() {
  local file="$1"
  local lines="${2:-40}"
  if [[ -f "$file" ]]; then
    tail -n "$lines" "$file"
  fi
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

    if (( announced_backend == 0 )) && [[ "$line" == *"Bind for 0.0.0.0:5432 failed"* || "$line" == *"port is already allocated"* ]]; then
      echo "[run.sh] Startup failed: ${line}" >&2
      tail_log "$DEV_LOG_FILE" 80 >&2
      return 1
    fi

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

db_url_for_port() {
  local port="$1"
  printf 'postgresql://%s:%s@127.0.0.1:%s/%s' \
    "${DB_USER:-vibescan}" \
    "${DB_PASSWORD:-vibescan}" \
    "$port" \
    "${DB_NAME:-vibescan}"
}

find_matching_database_url_for_port() {
  local port="$1"
  local candidates=(
    "$(db_url_for_port "$port")"
    "postgresql://vibescan:vibescan@127.0.0.1:${port}/${DB_NAME:-vibescan}"
    "postgresql://postgres:postgres@127.0.0.1:${port}/${DB_NAME:-vibescan}"
  )

  local database_url
  local diff_output=""

  for database_url in "${candidates[@]}"; do
    if diff_output="$(cd "$WASP_DIR" && DATABASE_URL="$database_url" npx prisma migrate diff --from-url "$database_url" --to-schema-datamodel schema.prisma --exit-code 2>&1)"; then
      printf '%s' "$database_url"
      return 0
    fi
  done

  return 1
}

database_schema_matches() {
  local port="$1"
  local matched_url=""
  matched_url="$(find_matching_database_url_for_port "$port" || true)"
  if [[ -n "$matched_url" ]]; then
    export DATABASE_URL="$matched_url"
    echo "[run.sh] Existing database on ${port} matches current Prisma schema" >&2
    return 0
  fi

  echo "[run.sh] Existing database on ${port} is not reusable; switching to ${FALLBACK_DB_PORT}" >&2
  return 1
}

resolve_db_port() {
  local managed_port=""
  managed_port="$(managed_postgres_port)"
  if [[ -n "$managed_port" ]]; then
    echo "[run.sh] Reusing managed PostgreSQL container on port ${managed_port}" >&2
    printf '%s' "$managed_port"
    return 0
  fi

  local preferred_port="$DEFAULT_DB_PORT"

  if is_port_free "$preferred_port"; then
    echo "[run.sh] Port ${preferred_port} is free; using local Postgres there" >&2
    printf '%s' "$preferred_port"
    return 0
  fi

  if database_schema_matches "$preferred_port"; then
    printf '%s' "$preferred_port"
    return 0
  fi

  local fallback_port="$FALLBACK_DB_PORT"
  if ! is_port_free "$fallback_port"; then
    fallback_port="$(choose_free_port "$fallback_port")"
  fi

  echo "[run.sh] Using database port ${fallback_port}" >&2
  printf '%s' "$fallback_port"
}

start_database() {
  local db_port="$1"
  export DB_PORT="$db_port"
  if [[ -z "${DATABASE_URL:-}" ]]; then
    export DATABASE_URL
    DATABASE_URL="$(db_url_for_port "$db_port")"
  fi

  if managed_postgres_is_running; then
    local managed_port
    managed_port="$(managed_postgres_port)"
    if [[ "$managed_port" == "$db_port" ]]; then
      echo "[run.sh] Reusing running PostgreSQL container on port ${db_port}" >&2
      return 0
    fi
  fi

  if [[ "$db_port" == "$DEFAULT_DB_PORT" ]] && ! is_port_free "$DEFAULT_DB_PORT"; then
    echo "[run.sh] Reusing existing database on ${DEFAULT_DB_PORT}" >&2
    return 0
  fi

  echo "[run.sh] Starting local PostgreSQL on port ${db_port}..." >&2
  docker compose up -d postgres
  wait_for_container_health vibescan-postgres 120
}

start_infra() {
  local db_port
  db_port="$(resolve_db_port)"
  start_database "$db_port"

  docker compose up -d redis minio
  wait_for_container_health vibescan-redis 120
  wait_for_container_health vibescan-minio 120
}

stop_all() {
  cleanup_dev_ports
  if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
    docker compose down --remove-orphans >/dev/null 2>&1 || true
  fi
}

start_wasp() {
  cd "$WASP_DIR"
  local host_ip
  host_ip="$(hostname -I 2>/dev/null | awk '{print $1}')"
  if [[ -z "${host_ip:-}" ]]; then
    host_ip="127.0.0.1"
  fi
  local public_host="${DEV_PUBLIC_HOST:-$host_ip}"
  local api_host="${DEV_API_HOST:-$host_ip}"

  export PATH="$SCANNER_TOOLS_BIN:$PATH"
  export OWASP_DATA_DIRECTORY="${OWASP_DATA_DIRECTORY:-$WASP_DIR/.cache/owasp/data}"
  export PORT="${PORT:-3555}"
  export WASP_SERVER_URL="${WASP_SERVER_URL:-http://${api_host}:3555}"
  export WASP_WEB_CLIENT_URL="${WASP_WEB_CLIENT_URL:-http://${public_host}:3000}"
  export REACT_APP_API_URL="${REACT_APP_API_URL:-http://${api_host}:3555}"
  export NEXT_PUBLIC_API_URL="${NEXT_PUBLIC_API_URL:-http://${api_host}:3555}"
  export VITE_API_PROXY_TARGET="${VITE_API_PROXY_TARGET:-http://${api_host}:3555}"
  export SKIP_EMAIL_VERIFICATION_IN_DEV="${SKIP_EMAIL_VERIFICATION_IN_DEV:-true}"
  export DATABASE_URL="${DATABASE_URL:-$(db_url_for_port "${DB_PORT:-$DEFAULT_DB_PORT}")}"

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
