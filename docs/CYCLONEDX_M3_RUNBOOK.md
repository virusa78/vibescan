# CycloneDX M3 Runbook: Staged Canary Cutover

## Scope
M3 rollout for CycloneDX pipeline with S3 artifact capture, strict drift gate (`0.10`), canary decision engine, and rollback-first semantics.

## Preflight
1. Confirm mode flags are explicitly set:
   - `VIBESCAN_CYCLONEDX_SHADOW_ENABLED`
   - `VIBESCAN_CYCLONEDX_CUTOVER_ENABLED`
   - `VIBESCAN_CYCLONEDX_ROLLBACK_ENABLED`
2. Confirm strict drift threshold:
   - `VIBESCAN_CYCLONEDX_DRIFT_RATE_THRESHOLD=0.10`
3. Confirm artifact capture config:
   - `VIBESCAN_CYCLONEDX_ARTIFACT_CAPTURE_ENABLED=true`
   - `VIBESCAN_CYCLONEDX_ARTIFACT_BUCKET` (or fallback `AWS_S3_FILES_BUCKET`)
   - `VIBESCAN_CYCLONEDX_ARTIFACT_RETENTION_DAYS`
4. Run smoke evidence pack:
   - `npm run smoke:cyclonedx:m3`

## Stage 1: Shadow Smoke
1. Set:
   - `VIBESCAN_CYCLONEDX_CANARY_STAGE=shadow_smoke`
   - `VIBESCAN_CYCLONEDX_SHADOW_ENABLED=true`
   - `VIBESCAN_CYCLONEDX_CUTOVER_ENABLED=false`
   - `VIBESCAN_CYCLONEDX_ROLLBACK_ENABLED=false`
2. Observe `ingestionMeta.gate` per scanner and confirm:
   - no `validation_error` / `unify_error` blockers
   - drift does not exceed `0.10`
   - `canaryDecision.status=allow_promote`

## Stage 2: Canary Cutover Cohort
1. Set:
   - `VIBESCAN_CYCLONEDX_CANARY_STAGE=canary_cutover_cohort`
   - `VIBESCAN_CYCLONEDX_CUTOVER_ENABLED=true`
   - keep rollback flag `false`
2. Run smoke and cohort checks.
3. Promotion criteria:
   - no blocker ingestion errors on cohort
   - drift <= `0.10`
   - `canaryDecision.status=allow_promote`

## Stage 3: Expand Cohort
1. Set:
   - `VIBESCAN_CYCLONEDX_CANARY_STAGE=expand_cohort`
   - `VIBESCAN_CYCLONEDX_CUTOVER_ENABLED=true`
2. Expand traffic gradually.
3. Keep monitoring gate reasons and artifact warnings.

## Rollback (Priority Path)
1. Immediate rollback switch:
   - `VIBESCAN_CYCLONEDX_ROLLBACK_ENABLED=true`
2. Expected behavior:
   - `gate.status=not_applicable`
   - `canaryDecision.status=rollback_required`
   - read path remains legacy-safe
3. Do not promote while rollback is active.

## Artifact Retention
1. Capture failures are warnings only; scan completion must continue.
2. Run cleanup runner periodically:
   - `npm run retention:cyclonedx:m3 -- --metadata-file docs/CYCLONEDX_ARTIFACT_METADATA.json --write-back`
   - format example: `docs/CYCLONEDX_ARTIFACT_METADATA.sample.json`
3. Validate cleanup summary output for removed keys and warnings.

## Evidence Pack
Artifacts produced by smoke command:
- `docs/CYCLONEDX_M3_SMOKE_EVIDENCE.json`
- `docs/CYCLONEDX_M3_SMOKE_REPORT.md`
- schema: `docs/CYCLONEDX_M3_EVIDENCE_SCHEMA.json`
