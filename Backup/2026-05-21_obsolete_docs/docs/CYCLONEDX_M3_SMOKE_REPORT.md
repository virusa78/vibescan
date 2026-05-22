# CycloneDX M3 Smoke Report

Generated at: 2026-04-23T07:39:08.206Z
Drift blocker threshold: 0.10

## Checks
- [x] gate-allows-promote-at-drift-<=-0.10 — status=allow_cutover, canary=allow_promote, drift=0.1000
- [x] gate-blocks-promote-at-drift->-0.10 — status=block_cutover, canary=block_promote
- [x] gate-blocks-on-validation-error — status=block_cutover, blockers=validation_error
- [x] rollback-forces-rollback-required — status=not_applicable, canary=rollback_required

## Summary
- Passed: 4
- Failed: 0
- Promotion ready: true
- Rollback verified: true
- Blocker errors: validation_error

JSON evidence: /home/virus/vibescan/docs/CYCLONEDX_M3_SMOKE_EVIDENCE.json
