#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

usage() {
  cat <<'EOF'
Usage:
  ./scripts/wasp-dev.sh          Start the VibeScan dev contour
  ./scripts/wasp-dev.sh up       Start the VibeScan dev contour
  ./scripts/wasp-dev.sh down     Stop the VibeScan dev contour
  ./scripts/wasp-dev.sh status   Show Docker and health status
EOF
}

status() {
  if command -v docker >/dev/null 2>&1; then
    docker compose ps postgres redis minio vibescan || true
  fi

  if command -v curl >/dev/null 2>&1; then
    for url in "http://127.0.0.1:3555/docs/swagger.json" "http://127.0.0.1:3000"; do
      if curl -fsS "$url" >/dev/null 2>&1; then
        echo "OK $url"
      else
        echo "DOWN $url"
      fi
    done
  fi
}

case "${1:-up}" in
  up)
    exec "$ROOT_DIR/run.sh"
    ;;
  down|--stop)
    exec "$ROOT_DIR/run.sh" --stop
    ;;
  status)
    status
    ;;
  help|--help|-h)
    usage
    ;;
  *)
    echo "Unknown command: $1" >&2
    usage >&2
    exit 1
    ;;
esac
