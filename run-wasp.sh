#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WASP_DIR="$ROOT_DIR/wasp-app"

if ! command -v wasp >/dev/null 2>&1; then
  echo "Wasp CLI is not installed."
  echo "Install with: curl -sSL https://get.wasp-lang.dev/installer.sh | sh"
  exit 1
fi

if [[ ! -f "$WASP_DIR/main.wasp" ]]; then
  echo "Wasp app not found at $WASP_DIR/main.wasp"
  exit 1
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

detect_server_ip() {
  local server_ip
  server_ip="$(hostname -I 2>/dev/null | awk '{print $1}')"
  if [[ -z "${server_ip:-}" ]]; then
    server_ip="127.0.0.1"
  fi
  printf '%s' "$server_ip"
}

cd "$WASP_DIR"
cleanup_dev_ports
SERVER_IP="$(detect_server_ip)"
export PORT="${PORT:-3555}"
export WASP_SERVER_URL="${WASP_SERVER_URL:-http://${SERVER_IP}:3555}"
export WASP_WEB_CLIENT_URL="${WASP_WEB_CLIENT_URL:-http://${SERVER_IP}:3000}"
export REACT_APP_API_URL="${REACT_APP_API_URL:-http://${SERVER_IP}:3000}"
export NEXT_PUBLIC_API_URL="${NEXT_PUBLIC_API_URL:-http://${SERVER_IP}:3000}"
export VITE_API_PROXY_TARGET="${VITE_API_PROXY_TARGET:-http://${SERVER_IP}:3555}"
export SKIP_EMAIL_VERIFICATION_IN_DEV="${SKIP_EMAIL_VERIFICATION_IN_DEV:-true}"
if [[ ! -f .wasp/out/db/schema.prisma ]]; then
  wasp clean
fi
exec wasp start
