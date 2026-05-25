#!/usr/bin/env bash
# Simple wrapper to trigger Zoho resync and poll status using the Node poll script
# Usage: BACKEND_URL=http://127.0.0.1:3555 API_TOKEN=token WORKSPACE_ID=wid ./scripts/zoho/check_zoho_sync.sh
set -euo pipefail
SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
NODE=$(command -v node || true)
if [ -z "$NODE" ]; then
  echo "Node.js not found in PATH. Install Node 18+ to run the poll script." >&2
  exit 2
fi
if [ ! -f "$SCRIPT_DIR/poll_zoho_sync.js" ]; then
  echo "Missing poll_zoho_sync.js in $SCRIPT_DIR" >&2
  exit 2
fi

# Ensure the poll script is executable
chmod +x "$SCRIPT_DIR/poll_zoho_sync.js"

# Forward env and run
node "$SCRIPT_DIR/poll_zoho_sync.js"
