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

cd "$WASP_DIR"
export PORT="${PORT:-4001}"
exec wasp start
