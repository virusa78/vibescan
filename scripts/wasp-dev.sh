#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WASP_DIR="$ROOT_DIR/wasp-app"
RUN_DIR="$ROOT_DIR/.run"
LOG_DIR="$ROOT_DIR/.logs/wasp-dev"
PID_FILE="$RUN_DIR/wasp-dev.pid"
FRONTEND_URL_FILE="$RUN_DIR/wasp-dev.frontend-url"
LOG_FILE="$LOG_DIR/wasp-dev.log"

HOST="${HOST:-127.0.0.1}"
SERVER_PORT="${SERVER_PORT:-3001}"
CLIENT_PORT="${CLIENT_PORT:-3000}"
START_DOCKER=1
MIGRATE_DB=1

mkdir -p "$RUN_DIR" "$LOG_DIR"

die() { echo "ERROR: $*" >&2; exit 1; }
info() { echo "[wasp-dev] $*"; }
warn() { echo "[wasp-dev][warn] $*"; }

usage() {
  cat <<EOF
Usage: ./scripts/wasp-dev.sh [up|down|status] [options]

Commands:
  up                    Start WASP dev contour
  down                  Stop WASP dev contour
  status                Show contour status

Options:
  --server-port <port>  Wasp server port (default: 3001)
  --client-port <port>  Expected frontend port (default: 3000)
  --no-docker           Do not start docker infra
  --no-migrate          Skip wasp db migrate-dev
EOF
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || die "Required command not found: $1"
}

kill_pid() {
  local pid="$1"
  if kill -0 "$pid" 2>/dev/null; then
    kill "$pid" 2>/dev/null || true
    sleep 1
    kill -0 "$pid" 2>/dev/null && kill -9 "$pid" 2>/dev/null || true
  fi
}

wait_http() {
  local url="$1"
  local timeout="${2:-120}"
  local i
  for ((i=1; i<=timeout; i++)); do
    if curl -fsS "$url" >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done
  return 1
}

wait_log_regex() {
  local regex="$1"
  local timeout="${2:-180}"
  local i
  for ((i=1; i<=timeout; i++)); do
    if grep -Eq "$regex" "$LOG_FILE"; then
      return 0
    fi
    sleep 1
  done
  return 1
}

get_detected_frontend_url() {
  echo "http://${HOST}:${CLIENT_PORT}"
}

detect_frontend_url() {
  local timeout="${1:-240}"
  local url="http://${HOST}:${CLIENT_PORT}"
  wait_http "$url" "$timeout" || return 1
  echo "$url"
  return 0
}

load_env() {
  set -a
  [[ -f "$WASP_DIR/.env.server" ]] && . "$WASP_DIR/.env.server"
  [[ -f "$ROOT_DIR/.env" ]] && . "$ROOT_DIR/.env"
  set +a

  if [[ -z "${DATABASE_URL:-}" && ( -n "${DB_HOST:-}" || -n "${DB_NAME:-}" ) ]]; then
    export DATABASE_URL="postgresql://${DB_USER:-postgres}:${DB_PASSWORD:-}@${DB_HOST:-localhost}:${DB_PORT:-5432}/${DB_NAME:-postgres}"
  fi
  export PORT="$SERVER_PORT"
  export FRONTEND_URL="http://${HOST}:${CLIENT_PORT}"
}

down() {
  if [[ -f "$PID_FILE" ]]; then
    local pid
    pid="$(cat "$PID_FILE" 2>/dev/null || true)"
    [[ -n "${pid:-}" ]] && kill_pid "$pid"
    rm -f "$PID_FILE"
  fi
  rm -f "$FRONTEND_URL_FILE"

  while IFS= read -r pid; do
    [[ -n "$pid" ]] && kill_pid "$pid"
  done < <(pgrep -f "$WASP_DIR|wasp start|nodemon --exec|bundle/server.js|node .*wasp-app.*vite" || true)

  while IFS= read -r pid; do
    [[ -n "$pid" ]] && kill_pid "$pid"
  done < <(lsof -tiTCP:"$SERVER_PORT" -sTCP:LISTEN || true)

  while IFS= read -r pid; do
    [[ -n "$pid" ]] && kill_pid "$pid"
  done < <(lsof -tiTCP:"$CLIENT_PORT" -sTCP:LISTEN || true)

  info "WASP dev contour stopped"
}

up() {
  require_cmd node
  require_cmd npm
  require_cmd curl
  require_cmd wasp

  down

  if [[ "$START_DOCKER" -eq 1 ]]; then
    require_cmd docker
    info "Starting docker infra (postgres, redis, minio)"
    docker compose up -d postgres redis minio >/dev/null
  fi

  load_env

  if [[ "$MIGRATE_DB" -eq 1 ]]; then
    info "Applying Wasp DB migrations..."
    (
      cd "$WASP_DIR"
      CI=1 npx wasp db migrate-dev --name dev_auto_sync >/dev/null
    ) || warn "wasp db migrate-dev failed, continuing with current schema"
  fi

  : > "$LOG_FILE"
  info "Starting Wasp dev contour..."
  (
    cd "$WASP_DIR"
    nohup env CI=1 npx wasp start </dev/null >>"$LOG_FILE" 2>&1 &
    echo $! > "$PID_FILE"
  )

  wait_log_regex "Server listening on port ${SERVER_PORT}" 420 || die "Server startup log not found for port ${SERVER_PORT}. See $LOG_FILE"
  wait_http "http://${HOST}:${SERVER_PORT}" 240 || die "Server did not start at http://${HOST}:${SERVER_PORT}. See $LOG_FILE"
  local frontend_url
  frontend_url="$(detect_frontend_url 240)" || die "Unable to detect frontend URL. See $LOG_FILE"
  wait_http "$frontend_url" 180 || die "Frontend did not start at $frontend_url. See $LOG_FILE"
  echo "$frontend_url" > "$FRONTEND_URL_FILE"

  info "Started"
  info "Frontend: ${frontend_url}"
  info "Server:   http://${HOST}:${SERVER_PORT}"
  info "Logs:     $LOG_FILE"
}

status() {
  local running="no"
  local frontend_url
  frontend_url=""
  if [[ -f "$FRONTEND_URL_FILE" ]]; then
    frontend_url="$(cat "$FRONTEND_URL_FILE" 2>/dev/null || true)"
  fi
  if [[ -z "${frontend_url:-}" ]]; then
    frontend_url="$(get_detected_frontend_url | sed 's#/$##')"
  fi
  if [[ -f "$PID_FILE" ]] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
    running="yes"
  fi
  echo "running: $running"
  echo "frontend: ${frontend_url:-unknown}"
  echo "server:   http://${HOST}:${SERVER_PORT}"
  echo "log:      $LOG_FILE"
}

COMMAND="${1:-up}"
shift || true

while [[ $# -gt 0 ]]; do
  case "$1" in
    --server-port) SERVER_PORT="$2"; shift 2 ;;
    --client-port) CLIENT_PORT="$2"; shift 2 ;;
    --no-docker) START_DOCKER=0; shift ;;
    --no-migrate) MIGRATE_DB=0; shift ;;
    -h|--help) usage; exit 0 ;;
    *) die "Unknown option: $1" ;;
  esac
done

case "$COMMAND" in
  up) up ;;
  down) down ;;
  status) status ;;
  *) usage; exit 1 ;;
esac
