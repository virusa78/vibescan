#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WASP_DIR="$ROOT_DIR/wasp-app"
TOOLS_DIR="$ROOT_DIR/.tools"
BIN_DIR="$TOOLS_DIR/bin"
NPM_PREFIX="$TOOLS_DIR/npm-global"
OWASP_INSTALL_DIR="$TOOLS_DIR/dependency-check"
OWASP_DATA_DIR="${OWASP_DATA_DIRECTORY:-$WASP_DIR/.cache/owasp/data}"
OWASP_IMAGE="${VIBESCAN_OWASP_IMAGE:-owasp/dependency-check:latest}"
OWASP_COMMAND="${OWASP_COMMAND:-dependency-check}"

BLUE='\033[0;34m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $*"; }
log_success() { echo -e "${GREEN}[✓]${NC} $*"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $*"; }
log_error() { echo -e "${RED}[ERROR]${NC} $*"; }

usage() {
  cat <<'EOF'
Usage:
  ./scripts/install-scanner-tooling.sh update   Install/update all scanner tooling (default)
  ./scripts/install-scanner-tooling.sh install  Same as update
  ./scripts/install-scanner-tooling.sh status   Show scanner/tool cache status
  ./scripts/install-scanner-tooling.sh warmup    Refresh only the OWASP Dependency-Check database

Managed tooling:
  - grype
  - trivy
  - snyk
  - OWASP Dependency-Check cache

Excluded:
  - Codescoring Johnny (lives on another machine)
EOF
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || {
    log_error "Missing required command: $1"
    exit 1
  }
}

ensure_dirs() {
  mkdir -p "$BIN_DIR" "$NPM_PREFIX" "$OWASP_INSTALL_DIR" "$OWASP_DATA_DIR"
}

install_grype() {
  log_info "Installing/updating Grype..."
  require_cmd curl
  require_cmd bash

  curl -fsSL https://raw.githubusercontent.com/anchore/grype/main/install.sh | \
    sh -s -- -b "$BIN_DIR"

  log_success "Grype installed to $BIN_DIR/grype"
}

install_trivy() {
  log_info "Installing/updating Trivy..."
  require_cmd curl
  require_cmd bash

  curl -fsSL https://raw.githubusercontent.com/aquasecurity/trivy/main/contrib/install.sh | \
    sh -s -- -b "$BIN_DIR"

  log_success "Trivy installed to $BIN_DIR/trivy"
}

install_snyk() {
  log_info "Installing/updating Snyk..."
  require_cmd npm

  npm install --prefix "$NPM_PREFIX" snyk@latest >/dev/null
  ln -sf "$NPM_PREFIX/bin/snyk" "$BIN_DIR/snyk"

  log_success "Snyk installed to $BIN_DIR/snyk"
}

install_owasp_cli() {
  log_info "Installing/updating OWASP Dependency-Check CLI..."
  require_cmd curl
  require_cmd python3
  require_cmd unzip
  require_cmd bash
  require_cmd java

  local release_json release_version asset_url tmp_dir tmp_zip install_root bin_path
  release_json="$(curl -fsSL https://api.github.com/repos/jeremylong/DependencyCheck/releases/latest)"
  release_version="$(python3 -c 'import json, sys; data = json.load(sys.stdin); print(data["tag_name"].lstrip("v"))' <<<"$release_json")"
  asset_url="$(python3 -c 'import json, sys; data = json.load(sys.stdin); version = data["tag_name"].lstrip("v"); print(next((asset.get("browser_download_url", "") for asset in data.get("assets", []) if asset.get("name") == f"dependency-check-{version}-release.zip"), ""))' <<<"$release_json")"

  if [[ -z "$asset_url" ]]; then
    log_error "Could not find a Dependency-Check release asset"
    exit 1
  fi

  tmp_dir="$(mktemp -d)"
  tmp_zip="$tmp_dir/dependency-check.zip"
  install_root="$OWASP_INSTALL_DIR/$release_version"

  curl -fsSL "$asset_url" -o "$tmp_zip"
  rm -rf "$install_root"
  mkdir -p "$install_root"
  unzip -q "$tmp_zip" -d "$install_root"

  bin_path="$(find "$install_root" -path '*/bin/dependency-check.sh' | head -n 1)"
  if [[ -z "$bin_path" ]]; then
    log_error "Dependency-Check archive did not contain dependency-check.sh"
    exit 1
  fi

  ln -sf "$bin_path" "$BIN_DIR/dependency-check"
  ln -sf "$bin_path" "$BIN_DIR/dependency-check.sh"

  rm -rf "$tmp_dir"

  log_success "OWASP Dependency-Check installed to $BIN_DIR/dependency-check (v$release_version)"
}

warmup_owasp_local() {
  require_cmd "$OWASP_COMMAND"
  log_info "Refreshing OWASP Dependency-Check database with local command..."
  "$OWASP_COMMAND" --updateonly --data "$OWASP_DATA_DIR"
  log_success "OWASP Dependency-Check database updated at $OWASP_DATA_DIR"
}

warmup_owasp_docker() {
  require_cmd docker
  log_info "Refreshing OWASP Dependency-Check database via Docker..."
  docker pull "$OWASP_IMAGE" >/dev/null
  docker run --rm \
    --user "$(id -u):$(id -g)" \
    --volume "$OWASP_DATA_DIR:/usr/share/dependency-check/data" \
    "$OWASP_IMAGE" \
    --updateonly
  log_success "OWASP Dependency-Check database updated at $OWASP_DATA_DIR"
}

warmup_owasp() {
  case "${OWASP_RUNTIME:-auto}" in
    local)
      warmup_owasp_local
      ;;
    docker)
      warmup_owasp_docker
      ;;
    *)
      if command -v "$OWASP_COMMAND" >/dev/null 2>&1; then
        warmup_owasp_local
      else
        warmup_owasp_docker
      fi
      ;;
  esac
}

print_status() {
  log_info "Scanner tooling status"
  echo

  local scanners=(
    "grype:$BIN_DIR/grype"
    "trivy:$BIN_DIR/trivy"
    "snyk:$BIN_DIR/snyk"
    "owasp:$BIN_DIR/dependency-check"
  )

  for entry in "${scanners[@]}"; do
    local name="${entry%%:*}"
    local path="${entry#*:}"
    if [[ -x "$path" ]]; then
      printf '%-10s %s\n' "$name" "installed ($path)"
    else
      printf '%-10s %s\n' "$name" "missing"
    fi
  done

  if command -v "$OWASP_COMMAND" >/dev/null 2>&1; then
    printf '%-10s %s\n' "owasp" "local command available ($OWASP_COMMAND)"
  elif command -v docker >/dev/null 2>&1; then
    printf '%-10s %s\n' "owasp" "docker runtime available ($OWASP_IMAGE)"
  else
    printf '%-10s %s\n' "owasp" "missing runtime"
  fi

  echo
  printf '%-10s %s\n' "cache" "$OWASP_DATA_DIR"
  if command -v du >/dev/null 2>&1 && [[ -d "$OWASP_DATA_DIR" ]]; then
    du -sh "$OWASP_DATA_DIR" 2>/dev/null || true
  fi
}

install_all() {
  ensure_dirs
  install_grype
  install_trivy
  install_snyk
  install_owasp_cli
  warmup_owasp
}

main() {
  local command="${1:-update}"

  case "$command" in
    install|update)
      install_all
      ;;
    warmup)
      ensure_dirs
      warmup_owasp
      ;;
    status)
      print_status
      ;;
    help|-h|--help)
      usage
      ;;
    *)
      log_error "Unknown command: $command"
      usage
      exit 1
      ;;
  esac
}

main "$@"
