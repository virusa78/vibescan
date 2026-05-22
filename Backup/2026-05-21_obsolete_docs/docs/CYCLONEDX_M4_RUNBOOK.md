# CycloneDX M4 Runbook: Staging-First Production Cutover Readiness

## Scope
M4 introduces DB-backed rollout state, aggregated staging SLO gates, and rollback-first promotion control for the CycloneDX pipeline.

## Preflight
1. Confirm rollout stage is set explicitly:
   - `VIBESCAN_CYCLONEDX_CANARY_STAGE=shadow_smoke`
   - `VIBESCAN_CYCLONEDX_CANARY_STAGE=canary_cutover_cohort`
   - `VIBESCAN_CYCLONEDX_CANARY_STAGE=expand_cohort`
   - `VIBESCAN_CYCLONEDX_CANARY_STAGE=ready_for_prod`
2. Confirm drift blocker:
   - `VIBESCAN_CYCLONEDX_DRIFT_RATE_THRESHOLD=0.10`
3. Confirm rollback guard remains available:
   - `VIBESCAN_CYCLONEDX_ROLLBACK_ENABLED=true` only when immediate rollback is required
4. Start the Wasp stack and allow worker writes to persist rollout snapshots.

## Stage Flow
1. `shadow_smoke`
   - Validate the staging pool can ingest without blocker errors.
   - Confirm warnings, including artifact upload failures, do not block promotion.
2. `canary_cutover_cohort`
   - Observe the aggregated window over recent scans.
   - Block promotion if any `validation_error` or `unify_error` appears.
3. `expand_cohort`
   - Widen the cohort only after the window remains clean.
   - Confirm drift stays at or below `0.10`.
4. `ready_for_prod`
   - Only reach this stage after an allow-promote window decision.
   - Persist the final decision summary in the rollout state table.

## Evaluate Gate
Run the acceptance command:

```bash
npm run smoke:cyclonedx:m4
```

The command:
1. Collects a rollout window from DB or `--input-file`.
2. Evaluates aggregated blocker/error/drift conditions.
3. Writes `docs/CYCLONEDX_M4_EVIDENCE.json`.
4. Writes `docs/CYCLONEDX_M4_REPORT.md`.
5. Updates the rollout state when DB writes are enabled.

## Decision Rules
1. `allow_promote`
   - No blocker ingestion errors.
   - Drift is at or below `0.10`.
   - No rollback marker is present.
2. `block_promote`
   - Any `validation_error` or `unify_error` appears.
   - Drift exceeds `0.10`.
3. `rollback_required`
   - Rollback state appears anywhere in the evaluated window.
   - Rollback always outranks all other signals.

## Evidence Pack
The acceptance runner emits:
- `docs/CYCLONEDX_M4_EVIDENCE.json`
- `docs/CYCLONEDX_M4_REPORT.md`
- `docs/CYCLONEDX_M4_EVIDENCE_SCHEMA.json`

## Operator Actions
1. Hold promotion if the decision is `block_promote`.
2. Execute rollback if the decision is `rollback_required`.
3. Promote only after a clean `allow_promote` window and a persisted `ready_for_prod` state.
