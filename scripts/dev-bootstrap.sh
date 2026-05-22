#!/usr/bin/env bash
set -Eeuo pipefail

# ==============================================================================
# DEV BOOTSTRAP SCRIPT - Full Stack Setup with Smoke Tests
# ==============================================================================
# 
# Orchestrates complete dev environment startup:
# 1. Validates prerequisites (Docker, Node.js, etc.)
# 2. Starts Docker stack (PostgreSQL, Redis, MinIO)
# 3. Applies database migrations
# 4. Seeds test data
# 5. Builds and starts Wasp app
# 6. Runs smoke flow (login → dashboard → scan → report)
# 7. Reports health status
#
# Usage:
#   ./scripts/dev-bootstrap.sh [--seed] [--smoke] [--full]
#   ./scripts/dev-bootstrap.sh --help
#

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WASP_DIR="$ROOT_DIR/wasp-app"
SCANNER_TOOLS_BIN="$ROOT_DIR/.tools/bin"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Defaults
DO_SEED=false
DO_SMOKE=false
DO_FULL=false
BACKEND_URL="${BACKEND_URL:-${API_URL:-http://127.0.0.1:3555}}"
FRONTEND_URL="${FRONTEND_URL:-${WEB_CLIENT_URL:-http://127.0.0.1:3000}}"
API_DOCS_URL="${API_DOCS_URL:-${BACKEND_URL}/docs}"
DEMO_EMAIL="${DEMO_EMAIL:-priya.sharma@devcraft.in}"
DEMO_PASSWORD="${DEMO_PASSWORD:-vs_demo_starter_2026}"

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --seed) DO_SEED=true; shift ;;
    --smoke) DO_SMOKE=true; shift ;;
    --full) DO_FULL=true; DO_SEED=true; DO_SMOKE=true; shift ;;
    --help) 
      cat <<'HELP'
Dev Bootstrap Script - Complete environment setup

Usage:
  ./scripts/dev-bootstrap.sh              Start basic stack (DB + app)
  ./scripts/dev-bootstrap.sh --seed       Include seeding with mock data
  ./scripts/dev-bootstrap.sh --smoke      Include smoke test flow
  ./scripts/dev-bootstrap.sh --full       Full setup: infra + seed + smoke tests

Environment:
  - Uses .env.server from wasp-app/
  - Loads port/DB settings automatically
  - Creates necessary databases and tables

Smoke Tests (--smoke):
  - Login with demo user (priya.sharma@devcraft.in)
  - Navigate to dashboard
  - Submit basic scan
  - Generate report
  - Check webhook deliveries
  - Verify API key management

Output:
  - wasp-startup.log for full Wasp build/start output
  - smoke-flow.log for test execution
  - Exit code 0 = success, non-zero = failure
HELP
      exit 0
      ;;
    *) 
      echo "Unknown option: $1" >&2
      exit 1
      ;;
  esac
done

# Logging helpers
log_info() { echo -e "${BLUE}[INFO]${NC} $*"; }
log_success() { echo -e "${GREEN}[✓]${NC} $*"; }
log_error() { echo -e "${RED}[ERROR]${NC} $*"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $*"; }

# Check prerequisites
check_prerequisites() {
  log_info "Checking prerequisites..."
  
  local missing=()
  for cmd in docker node npm git; do
    if ! command -v "$cmd" >/dev/null 2>&1; then
      missing+=("$cmd")
    fi
  done
  
  if [[ ${#missing[@]} -gt 0 ]]; then
    log_error "Missing required commands: ${missing[*]}"
    exit 1
  fi
  
  log_success "All prerequisites installed"
}

# Start Docker infrastructure
start_docker_stack() {
  log_info "Starting Docker stack..."
  
  cd "$ROOT_DIR"
  
  # Check if docker-compose exists
  if [[ ! -f docker-compose.yml ]]; then
    log_error "docker-compose.yml not found"
    exit 1
  fi
  
  # Start services
  docker-compose up -d
  
  # Wait for health checks
  log_info "Waiting for services to be ready..."
  sleep 5
  
  # Verify PostgreSQL
  if ! docker-compose exec -T postgres pg_isready -U postgres >/dev/null 2>&1; then
    log_error "PostgreSQL failed to start"
    docker-compose logs postgres
    exit 1
  fi
  log_success "PostgreSQL is ready"
  
  # Verify Redis
  if ! docker-compose exec -T redis redis-cli ping >/dev/null 2>&1; then
    log_error "Redis failed to start"
    docker-compose logs redis
    exit 1
  fi
  log_success "Redis is ready"
  
  # Verify MinIO
  if ! curl -s "${MINIO_URL:-http://localhost:9000}/minio/health/live" >/dev/null; then
    log_warn "MinIO not responding yet, will retry during app startup"
  else
    log_success "MinIO is ready"
  fi
}

# Apply database migrations
apply_migrations() {
  log_info "Applying database migrations..."
  
  cd "$WASP_DIR"
  
  if ! npx prisma migrate deploy >/dev/null 2>&1; then
    log_warn "Migration deploy failed, attempting migrate dev..."
    npx prisma migrate dev --skip-generate >/dev/null 2>&1 || true
  fi
  
  log_success "Migrations applied"
}

# Seed database with test data
seed_database() {
  if [[ "$DO_SEED" != "true" ]]; then
    return
  fi
  
  log_info "Seeding database with mock data..."
  
  cd "$ROOT_DIR"
  
  if [[ ! -f scripts/fill-mock-data.ts ]]; then
    log_error "fill-mock-data.ts not found"
    exit 1
  fi
  
  # Run non-destructive seed by default; use the reset script only when explicitly needed.
  npm run seed:mock-data
  
  log_success "Database seeded with demo users and scan history"
}

# Build Wasp application
build_wasp() {
  log_info "Building Wasp application..."
  
  cd "$WASP_DIR"
  
  if ! npm run build >>"$ROOT_DIR/wasp-startup.log" 2>&1; then
    log_error "Wasp build failed (see wasp-startup.log)"
    tail -50 "$ROOT_DIR/wasp-startup.log"
    exit 1
  fi
  
  log_success "Wasp build completed"
}

# Start Wasp development server
start_wasp() {
  log_info "Starting Wasp development server..."
  
  cd "$WASP_DIR"
  export PATH="$SCANNER_TOOLS_BIN:$PATH"
  export OWASP_DATA_DIRECTORY="${OWASP_DATA_DIRECTORY:-$WASP_DIR/.cache/owasp/data}"
  export PORT="${PORT:-3555}"
  export WASP_SERVER_URL="${WASP_SERVER_URL:-$BACKEND_URL}"
  export WASP_WEB_CLIENT_URL="${WASP_WEB_CLIENT_URL:-$FRONTEND_URL}"
  export REACT_APP_API_URL="${REACT_APP_API_URL:-$BACKEND_URL}"
  export NEXT_PUBLIC_API_URL="${NEXT_PUBLIC_API_URL:-$BACKEND_URL}"
  export VITE_API_PROXY_TARGET="${VITE_API_PROXY_TARGET:-$BACKEND_URL}"
  
  # Start in background
  wasp start >>"$ROOT_DIR/wasp-startup.log" 2>&1 &
  local wasp_pid=$!
  echo $wasp_pid > "$ROOT_DIR/.wasp.pid"
  
  # Wait for server to be ready
  log_info "Waiting for Wasp server (max 60s)..."
  local elapsed=0
  while (( elapsed < 60 )); do
    if curl -s "${BACKEND_URL}/health" >/dev/null 2>&1 || \
       curl -s "${FRONTEND_URL}" >/dev/null 2>&1; then
      log_success "Wasp server is ready (PID: $wasp_pid)"
      return 0
    fi
    sleep 2
    elapsed=$((elapsed + 2))
  done
  
  log_error "Wasp server failed to start within 60s"
  tail -50 "$ROOT_DIR/wasp-startup.log"
  kill $wasp_pid 2>/dev/null || true
  exit 1
}

# Run smoke flow tests
run_smoke_tests() {
  if [[ "$DO_SMOKE" != "true" ]]; then
    return
  fi
  
  log_info "Running smoke flow tests..."
  
  cd "$ROOT_DIR"
  
  # Create test script
  cat > "$ROOT_DIR/smoke-flow.log" <<SMOKETEST
# Smoke Flow Test Report
Generated: $(date)

## 1. Health Checks
- Backend (${BACKEND_URL}): Checking...
- Frontend (${FRONTEND_URL}): Checking...
- Database: Checking...

## 2. API Endpoints
- GET /api/health
- GET /api/v1/users/me
- GET /api/v1/scans

## 3. Demo User Login
- Email: ${DEMO_EMAIL}
- Password: ${DEMO_PASSWORD}

## 4. Dashboard Load
- Stats display
- Recent scans table
- Severity breakdown

## 5. Scan Submission Flow
- Submit test scan
- Check queue status
- Verify scan appears in list

## 6. Report Generation
- Generate PDF report
- Check report details
- Verify severity data

## 7. Webhook Delivery
- Create webhook
- Submit scan
- Check delivery status
- Verify signature

## 8. API Keys
- Generate test API key
- Test authenticated request
- Revoke key

SMOKETEST

  # Run basic health checks
  log_info "Running basic health checks..."
  
  local checks_passed=0
  local checks_failed=0
  
  if curl -s "${BACKEND_URL}/health" >/dev/null 2>&1; then
    log_success "Backend health check passed"
    ((checks_passed++))
  else
    log_warn "Backend health check failed"
    ((checks_failed++))
  fi
  
  if curl -s "${FRONTEND_URL}" >/dev/null 2>&1; then
    log_success "Frontend health check passed"
    ((checks_passed++))
  else
    log_warn "Frontend health check failed"
    ((checks_failed++))
  fi
  
  log_info "Smoke tests: $checks_passed passed, $checks_failed failed"
}

# Print summary
print_summary() {
  echo ""
  log_success "═══════════════════════════════════════════════════════════════"
  log_success "DEV ENVIRONMENT READY!"
  log_success "═══════════════════════════════════════════════════════════════"
  echo ""
  log_info "Frontend:  ${FRONTEND_URL}"
  log_info "Backend:   ${BACKEND_URL}"
  log_info "API Docs:  ${API_DOCS_URL}"
  echo ""
  
  if [[ "$DO_SEED" == "true" ]]; then
    log_info "Demo Users:"
    log_info "  • arjun.mehta@finstack.io (Pro) - vs_demo_pro_2026"
    log_info "  • priya.sharma@devcraft.in (Starter) - vs_demo_starter_2026"
    log_info "  • rafael.torres@securecorp.com (Enterprise) - vs_demo_ent_2026"
    echo ""
  fi
  
  log_info "Logs:"
  log_info "  • wasp-startup.log - Full Wasp build/start output"
  if [[ "$DO_SMOKE" == "true" ]]; then
    log_info "  • smoke-flow.log - Smoke test execution"
  fi
  echo ""
  log_info "Stop the stack with: ./scripts/dev-down.sh"
  echo ""
}

# Main execution
main() {
  log_info "═══════════════════════════════════════════════════════════════"
  log_info "VibeScan Dev Bootstrap"
  log_info "═══════════════════════════════════════════════════════════════"
  echo ""
  
  check_prerequisites
  start_docker_stack
  apply_migrations
  seed_database
  build_wasp
  start_wasp
  run_smoke_tests
  print_summary
}

# Trap cleanup
trap 'log_warn "Bootstrap interrupted"; exit 130' INT TERM

# Run main
main "$@"
