#!/usr/bin/env bash
set -Eeuo pipefail

# ==============================================================================
# DEV DOWN SCRIPT - Cleanup and stop all dev services
# ==============================================================================

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $*"; }
log_success() { echo -e "${GREEN}[✓]${NC} $*"; }

log_info "Stopping VibeScan dev environment..."

# Kill Wasp process if running
if [[ -f "$ROOT_DIR/.wasp.pid" ]]; then
  local wasp_pid=$(cat "$ROOT_DIR/.wasp.pid")
  if ps -p "$wasp_pid" >/dev/null 2>&1; then
    log_info "Stopping Wasp server (PID: $wasp_pid)..."
    kill $wasp_pid 2>/dev/null || true
    sleep 2
  fi
  rm -f "$ROOT_DIR/.wasp.pid"
fi

# Stop Docker stack
if [[ -f "$ROOT_DIR/docker-compose.yml" ]]; then
  log_info "Stopping Docker services..."
  cd "$ROOT_DIR"
  docker-compose down --volumes || true
fi

log_success "Dev environment stopped"
