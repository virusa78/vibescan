#!/usr/bin/env bash
# Simulates an SBOM vulnerability scan as if executed by Black Duck.
# Usage: ./scripts/simulate-blackduck-sbom-scan.sh <sbom_path> [output_json_path]

set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <sbom_path> [output_json_path]"
  exit 1
fi

SBOM_PATH="$1"
OUTPUT_PATH="${2:-./blackduck-simulated-result.json}"

if [[ ! -f "$SBOM_PATH" ]]; then
  echo "[blackduck-sim] SBOM file not found: $SBOM_PATH"
  exit 1
fi

SEED="$(cksum "$SBOM_PATH" | awk '{print $1}')"
COMPONENT_COUNT="$(grep -Eo '"name"[[:space:]]*:' "$SBOM_PATH" | wc -l | tr -d ' ')"
if [[ "$COMPONENT_COUNT" -eq 0 ]]; then
  COMPONENT_COUNT=$(( (SEED % 55) + 12 ))
fi

CRITICAL_COUNT=$(( (SEED % 4) + 1 ))
HIGH_COUNT=$(( (SEED % 9) + 4 ))
MEDIUM_COUNT=$(( (SEED % 14) + 9 ))
LOW_COUNT=$(( (SEED % 12) + 7 ))
TOTAL_COUNT=$(( CRITICAL_COUNT + HIGH_COUNT + MEDIUM_COUNT + LOW_COUNT ))
POLICY_VIOLATIONS=$(( (SEED % 5) + 1 ))
EXPOSURE_INDEX=$(( (CRITICAL_COUNT * 25) + (HIGH_COUNT * 10) + MEDIUM_COUNT ))

echo "[blackduck-sim] $(date -Iseconds) starting simulated scan"
echo "[blackduck-sim] input SBOM: $SBOM_PATH"
echo "[blackduck-sim] indexing BOM components: $COMPONENT_COUNT"
sleep 1
echo "[blackduck-sim] running policy checks..."
sleep 1
echo "[blackduck-sim] correlating CVE intelligence..."
sleep 1
echo "[blackduck-sim] computing risk and remediation priority..."
sleep 1

cat > "$OUTPUT_PATH" <<EOF
{
  "engine": "blackduck",
  "mode": "simulation",
  "sbomPath": "$SBOM_PATH",
  "scannedAt": "$(date -Iseconds)",
  "summary": {
    "components": $COMPONENT_COUNT,
    "total": $TOTAL_COUNT,
    "critical": $CRITICAL_COUNT,
    "high": $HIGH_COUNT,
    "medium": $MEDIUM_COUNT,
    "low": $LOW_COUNT,
    "policyViolations": $POLICY_VIOLATIONS,
    "exposureIndex": $EXPOSURE_INDEX
  },
  "findings": [
    { "id": "CVE-2026-22001", "severity": "CRITICAL", "package": "spring-core", "fixVersion": "6.1.11", "exploitMaturity": "functional" },
    { "id": "CVE-2026-22002", "severity": "HIGH", "package": "jackson-databind", "fixVersion": "2.17.2", "exploitMaturity": "proof-of-concept" },
    { "id": "CVE-2026-22003", "severity": "MEDIUM", "package": "logback-classic", "fixVersion": "1.5.8", "exploitMaturity": "unproven" }
  ]
}
EOF

echo "[blackduck-sim] completed: $OUTPUT_PATH"
