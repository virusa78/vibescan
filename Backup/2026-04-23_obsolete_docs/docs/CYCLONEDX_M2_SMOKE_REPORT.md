# CycloneDX M2 Smoke Report

- Timestamp (UTC): `2026-04-23T07:22:57Z`
- Scope: M2 data quality + mapping loop smoke for `shadow/cutover/rollback` behavior, contract fixtures, unknown field catalog, and report read path.

## Executed Smoke Suite

```bash
npx jest test/unit/cyclonedxIngestionService.test.ts \
  test/unit/cyclonedxContractsFixtures.test.ts \
  test/unit/getReport.cyclonedxReadPath.test.ts \
  --runInBand
```

## Result

- Status: `PASS`
- Suites: `3 passed, 3 total`
- Tests: `14 passed, 14 total`

## Evidence by Area

1. Pipeline modes and quality gates (`test/unit/cyclonedxIngestionService.test.ts`)
- `legacy` default mode.
- `shadow` mode keeps legacy components and emits drift telemetry.
- `cutover` mode uses unified components.
- `rollback` mode keeps ingest active for unknown-field catalog while gate returns `not_applicable`.
- Gate blocks cutover on blocker errors (`validation_error`) and on drift-rate threshold breaches.

2. Contract fixtures baseline (`test/unit/cyclonedxContractsFixtures.test.ts`)
- Manifest-driven fixture execution (`test/fixtures/cyclonedx/manifest.json`).
- Fixture contract validated for ingested and rejected cases.
- Golden regression validates legacy-vs-cutover totals/severity consistency.
- Mapping loop proof: known mapped field (`supplier`) retained as mapped, custom fields captured as unknown catalog candidates.

3. Report read path cutover/rollback (`test/unit/getReport.cyclonedxReadPath.test.ts`)
- In `cutover`, `getReport` uses `ingestionMeta.unifiedStats` severity breakdown when available.
- In `rollback`, `getReport` ignores unified stats and falls back to legacy findings-derived severity totals.

## Notes

- This smoke report is unit-smoke level and does not include full runtime worker queue execution against live DB/Redis.
- Separate global `npx tsc --noEmit -p tsconfig.json` remains noisy/failing in unrelated existing project areas and is not used as M2 acceptance gate in this smoke run.
