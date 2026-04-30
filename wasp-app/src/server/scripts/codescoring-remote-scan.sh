#!/bin/bash
# codescoring-remote-scan.sh - Executed on the scanner machine via SSH
# This script handles repository cloning or ZIP extraction, runs Johnny, and cleans up.

set -e # Exit on any error

# Arguments
INPUT_TYPE=$1
INPUT_REF=$2
OUTPUT_FILE=$3

# Derived paths
TEMP_DIR=$(dirname "$OUTPUT_FILE")
REPO_DIR="$TEMP_DIR/repo"

echo "[Remote-Scan] Starting scan (Type: $INPUT_TYPE)"
echo "[Remote-Scan] Temp Directory: $TEMP_DIR"

# Cleanup function to be called on exit (success or failure)
cleanup() {
    local exit_code=$?
    echo "[Remote-Scan] Cleaning up..."
    if [ -d "$REPO_DIR" ]; then
        rm -rf "$REPO_DIR"
    fi
    # Note: We do NOT delete OUTPUT_FILE here, as we need to scp it back first.
    # The parent SSH session will delete the entire TEMP_DIR after scp.
    exit $exit_code
}

trap cleanup EXIT

# 1. Prepare repository/input
case "$INPUT_TYPE" in
    github)
        echo "[Remote-Scan] Cloning GitHub repository: $INPUT_REF"
        git clone --depth 1 --quiet "$INPUT_REF" "$REPO_DIR"
        ;;
    source_zip)
        # Zip is expected to be uploaded as $TEMP_DIR/source.zip by the caller
        ZIP_PATH="$TEMP_DIR/source.zip"
        if [ ! -f "$ZIP_PATH" ]; then
            echo "Error: source.zip not found at $ZIP_PATH" >&2
            exit 1
        fi
        echo "[Remote-Scan] Extracting ZIP: $ZIP_PATH"
        mkdir -p "$REPO_DIR"
        unzip -q "$ZIP_PATH" -d "$REPO_DIR"
        rm "$ZIP_PATH"
        ;;
    sbom)
        # SBOM is expected to be uploaded as $TEMP_DIR/sbom.json
        SBOM_PATH="$TEMP_DIR/sbom.json"
        if [ ! -f "$SBOM_PATH" ]; then
            echo "Error: sbom.json not found at $SBOM_PATH" >&2
            exit 1
        fi
        echo "[Remote-Scan] Using SBOM file: $SBOM_PATH"
        # For SBOM, we point Johnny directly to the file
        REPO_DIR="$SBOM_PATH"
        ;;
    *)
        echo "Error: Unknown input type $INPUT_TYPE" >&2
        exit 1
        ;;
esac

# 2. Run Johnny
echo "[Remote-Scan] Running Johnny scanner..."
# We assume 'johnny' is in the PATH and configured via remote YAML
if ! command -v johnny >/dev/null 2>&1; then
    echo "Error: 'johnny' command not found on remote machine." >&2
    exit 1
fi

johnny --input "$REPO_DIR" --output-format cyclonedx-json > "$OUTPUT_FILE"

echo "[Remote-Scan] Scan completed successfully. Output at $OUTPUT_FILE"
