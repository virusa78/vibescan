#!/usr/bin/env bash
# Simulates an SBOM vulnerability scan as if executed by Grype.
# Usage: ./scripts/simulate-grype-sbom-scan.sh <sbom_path> [output_json_path]

set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <sbom_path> [output_json_path]"
  exit 1
fi

SBOM_PATH="$1"
OUTPUT_PATH="${2:-./grype-simulated-result.json}"

if [[ ! -f "$SBOM_PATH" ]]; then
  echo "[grype-sim] SBOM file not found: $SBOM_PATH"
  exit 1
fi

SEED="$(cksum "$SBOM_PATH" | awk '{print $1}')"
COMPONENT_COUNT="$(grep -Eo '"name"[[:space:]]*:' "$SBOM_PATH" | wc -l | tr -d ' ')"
if [[ "$COMPONENT_COUNT" -eq 0 ]]; then
  COMPONENT_COUNT=$(( (SEED % 40) + 10 ))
fi

CRITICAL_COUNT=$(( (SEED % 3) + 1 ))
HIGH_COUNT=$(( (SEED % 7) + 3 ))
MEDIUM_COUNT=$(( (SEED % 12) + 8 ))
LOW_COUNT=$(( (SEED % 10) + 6 ))
TOTAL_COUNT=$(( CRITICAL_COUNT + HIGH_COUNT + MEDIUM_COUNT + LOW_COUNT ))

echo "[grype-sim] $(date -Iseconds) starting simulated scan"
echo "[grype-sim] input SBOM: $SBOM_PATH"
echo "[grype-sim] detected components: $COMPONENT_COUNT"
sleep 1
echo "[grype-sim] loading vulnerability DB..."
sleep 1
echo "[grype-sim] matching packages and CPEs..."
sleep 1
echo "[grype-sim] calculating severities and CVSS..."
sleep 1

cat > "$OUTPUT_PATH" <<EOF
{
  "engine": "grype",
  "mode": "simulation",
  "sbomPath": "$SBOM_PATH",
  "scannedAt": "$(date -Iseconds)",
  "summary": {
    "components": $COMPONENT_COUNT,
    "total": $TOTAL_COUNT,
    "critical": $CRITICAL_COUNT,
    "high": $HIGH_COUNT,
    "medium": $MEDIUM_COUNT,
    "low": $LOW_COUNT
  },
  "vulnerabilities": [
    { "id": "CVE-2026-12001", "severity": "CRITICAL", "package": "openssl", "fixVersion": "3.0.16" },
    { "id": "CVE-2026-12002", "severity": "HIGH", "package": "glibc", "fixVersion": "2.39-r1" },
    { "id": "CVE-2026-12003", "severity": "MEDIUM", "package": "zlib", "fixVersion": "1.3.1-r2" }
  ]
}
EOF

echo "[grype-sim] completed: $OUTPUT_PATH"
