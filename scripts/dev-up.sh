#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

BACKEND_PORT="${BACKEND_PORT:-3001}"
FRONTEND_PORT="${FRONTEND_PORT:-3000}"
HOST="${HOST:-0.0.0.0}"
USE_DOCKER_INFRA=1

RUN_DIR="$ROOT_DIR/.run"
LOG_DIR="$ROOT_DIR/.logs/dev"
BACKEND_PID_FILE="$RUN_DIR/backend.pid"
FRONTEND_PID_FILE="$RUN_DIR/frontend.pid"
BACKEND_LOG="$LOG_DIR/backend.log"
FRONTEND_LOG="$LOG_DIR/frontend.log"

mkdir -p "$RUN_DIR" "$LOG_DIR"

red() { printf "\033[31m%s\033[0m\n" "$*"; }
green() { printf "\033[32m%s\033[0m\n" "$*"; }
yellow() { printf "\033[33m%s\033[0m\n" "$*"; }
blue() { printf "\033[34m%s\033[0m\n" "$*"; }

die() { red "ERROR: $*"; exit 1; }
info() { blue "[dev-up] $*"; }
ok() { green "[ok] $*"; }
warn() { yellow "[warn] $*"; }

usage() {
  cat <<EOF
Usage: ./scripts/dev-up.sh [options]

Options:
  --backend-port <port>   Backend API port (default: 3001)
  --frontend-port <port>  Frontend port (default: 3000)
  --host <host>           Host for dev servers (default: 0.0.0.0)
  --no-docker             Do not start docker infra (postgres/redis/minio)
  --stop                  Stop previous dev sessions and exit
  -h, --help              Show this help
EOF
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || die "Required command not found: $1"
}

parse_args() {
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --backend-port)
        BACKEND_PORT="$2"
        shift 2
        ;;
      --frontend-port)
        FRONTEND_PORT="$2"
        shift 2
        ;;
      --host)
        HOST="$2"
        shift 2
        ;;
      --no-docker)
        USE_DOCKER_INFRA=0
        shift
        ;;
      --stop)
        stop_all
        ok "Stopped previous sessions"
        exit 0
        ;;
      -h|--help)
        usage
        exit 0
        ;;
      *)
        die "Unknown option: $1"
        ;;
    esac
  done
}

check_node_version() {
  local major
  major="$(node -p 'process.versions.node.split(".")[0]')"
  [[ "$major" -ge 24 ]] || die "Node.js >= 24 is required. Current: $(node -v)"
}

kill_pid() {
  local pid="$1"
  if kill -0 "$pid" 2>/dev/null; then
    kill "$pid" 2>/dev/null || true
    sleep 1
    if kill -0 "$pid" 2>/dev/null; then
      kill -9 "$pid" 2>/dev/null || true
    fi
  fi
}

stop_from_pid_file() {
  local pid_file="$1"
  if [[ -f "$pid_file" ]]; then
    local pid
    pid="$(cat "$pid_file" 2>/dev/null || true)"
    if [[ -n "${pid:-}" ]]; then
      kill_pid "$pid"
    fi
    rm -f "$pid_file"
  fi
}

kill_project_processes() {
  local patterns=(
    "tsx watch src/index.ts"
    "next dev"
  )

  for pattern in "${patterns[@]}"; do
    while IFS= read -r pid; do
      [[ -z "$pid" ]] && continue
      local cmd
      cmd="$(ps -p "$pid" -o command= 2>/dev/null || true)"
      if [[ "$cmd" == *"$ROOT_DIR"* || "$cmd" == *"$pattern"* ]]; then
        info "Stopping process pid=$pid ($pattern)"
        kill_pid "$pid"
      fi
    done < <(pgrep -f "$pattern" || true)
  done
}

free_port() {
  local port="$1"
  while IFS= read -r pid; do
    [[ -z "$pid" ]] && continue
    info "Freeing port $port (pid=$pid)"
    kill_pid "$pid"
  done < <(lsof -tiTCP:"$port" -sTCP:LISTEN || true)
}

stop_all() {
  info "Stopping previous dev sessions..."
  stop_from_pid_file "$BACKEND_PID_FILE"
  stop_from_pid_file "$FRONTEND_PID_FILE"
  kill_project_processes
  free_port "$BACKEND_PORT"
  free_port "$FRONTEND_PORT"
}

wait_http() {
  local url="$1"
  local timeout="${2:-60}"
  local i
  for ((i=1; i<=timeout; i++)); do
    if curl -fsS "$url" >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done
  return 1
}

start_docker_infra() {
  [[ "$USE_DOCKER_INFRA" -eq 1 ]] || return 0
  info "Starting docker infra (postgres, redis, minio)..."
  docker compose up -d postgres redis minio
}

prepare_frontend_env() {
  local server_ip
  server_ip="$(hostname -I 2>/dev/null | awk '{print $1}')"
  [[ -n "${server_ip:-}" ]] || server_ip="127.0.0.1"
  cat > "$ROOT_DIR/vibescan-ui/.env.local" <<EOF
NEXT_PUBLIC_API_URL=http://${server_ip}:${BACKEND_PORT}
EOF
}

start_backend() {
  : > "$BACKEND_LOG"
  info "Starting backend on ${HOST}:${BACKEND_PORT}"
  PORT="$BACKEND_PORT" npm run dev >"$BACKEND_LOG" 2>&1 &
  echo $! > "$BACKEND_PID_FILE"
  wait_http "http://127.0.0.1:${BACKEND_PORT}/health" 90 || die "Backend failed to become healthy. See $BACKEND_LOG"
  ok "Backend is ready"
}

start_frontend() {
  : > "$FRONTEND_LOG"
  info "Starting frontend on ${HOST}:${FRONTEND_PORT}"
  (
    cd "$ROOT_DIR/vibescan-ui"
    PORT="$FRONTEND_PORT" HOSTNAME="$HOST" npm run dev
  ) >"$FRONTEND_LOG" 2>&1 &
  echo $! > "$FRONTEND_PID_FILE"
  wait_http "http://127.0.0.1:${FRONTEND_PORT}" 120 || die "Frontend failed to start. See $FRONTEND_LOG"
  ok "Frontend is ready"
}

print_summary() {
  local server_ip
  server_ip="$(hostname -I 2>/dev/null | awk '{print $1}')"
  [[ -n "${server_ip:-}" ]] || server_ip="127.0.0.1"

  cat <<EOF

VibeScan dev environment is running:
  Backend:   http://${server_ip}:${BACKEND_PORT}
  Frontend:  http://${server_ip}:${FRONTEND_PORT}

Logs:
  Backend:   $BACKEND_LOG
  Frontend:  $FRONTEND_LOG

Stop:
  ./scripts/dev-up.sh --stop
EOF
}

main() {
  parse_args "$@"
  require_cmd node
  require_cmd npm
  require_cmd lsof
  require_cmd curl
  require_cmd awk
  check_node_version
  if [[ "$USE_DOCKER_INFRA" -eq 1 ]]; then
    require_cmd docker
  fi

  stop_all
  start_docker_infra
  prepare_frontend_env
  start_backend
  start_frontend
  print_summary
}

main "$@"
