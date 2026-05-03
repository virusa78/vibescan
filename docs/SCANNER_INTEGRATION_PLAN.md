# Scanner Integration Plan

This document describes the current provider-aware scanner model and the rules for adding or changing scanner providers without re-introducing worker-specific branches.

## Status

The provider-aware baseline is already implemented.

What changed compared to the older dual-scanner model:

- scanner runtimes now implement a shared provider contract from `wasp-app/src/server/lib/scanners/providerTypes.ts`
- scan planning is resolved through `providerSelection.ts`
- `Scan.plannedSources` stores the provider sources expected for a concrete scan at submission time
- read models derive source breakdowns from persisted `ScanResult` rows instead of assuming only `free` vs `enterprise`
- `Snyk` is no longer a hypothetical integration; it has runtime, readiness, credential resolution, health monitoring, and settings surface support

## Provider Contract

Each provider is responsible for:

- `kind`
- `displayName`
- `supportsUserSecrets`
- `getHealth(...)`
- `scanComponents(...)`

`scanComponents(...)` returns a normalized `ScannerScanResult`:

- `provider`
- `rawOutput`
- `findings`
- `durationMs`
- optional `scannerVersion`

This keeps provider-specific execution inside `wasp-app/src/server/lib/scanners/` and keeps lifecycle/persistence logic in shared services.

## Current Planning Model

Planning is resolved by `resolvePlannedScannerExecutions(...)` in `wasp-app/src/server/lib/scanners/providerSelection.ts`.

### Baseline matrix

- non-enterprise plans -> `grype`
- enterprise when Snyk feature is disabled -> `grype + codescoring-johnny`
- enterprise when Snyk feature is enabled and ready -> `grype + snyk`

Important detail: when Snyk is enabled for enterprise traffic, the planned parallel pair is `grype + snyk`. This is the current provider-aware comparison path.

### Parallel execution semantics

- `grype` remains the baseline source
- the secondary provider is selected by readiness-aware planning
- the orchestrator persists the exact planned sources on the `Scan`
- lifecycle completion uses those persisted sources, so a scan is finalized against the plan that existed at submission time, not against whatever provider policy is active later

## `plannedSources` and lifecycle safety

`Scan.plannedSources` is set during submission in `wasp-app/src/server/services/scanSubmissionService.ts`.

It is then used by `wasp-app/src/server/services/scanLifecycleService.ts` to determine:

- which providers are expected to finish
- whether a partial provider failure should still result in `done`
- whether a scan should end in `error`

This prevents drift when feature flags or provider routing rules change while previously submitted scans are still running.

## Snyk readiness and credential modes

Snyk readiness is computed by `wasp-app/src/server/services/scannerReadinessService.ts`.

### Feature gate

- `VIBESCAN_ENABLE_SNYK_SCANNER=true` enables Snyk planning

If the flag is off, Snyk is reported as disabled and cannot be selected.

### Credential modes

`VIBESCAN_SNYK_CREDENTIAL_MODE` supports:

- `auto`
  - prefer `SNYK_TOKEN` from environment when present
  - otherwise use the authenticated user's stored `snykApiKeyEncrypted`
- `environment`
  - require shared environment credential
  - readiness is `false` if `SNYK_TOKEN` is missing
- `user-secret`
  - require authenticated user context plus stored encrypted user key
  - readiness is `false` if the user has not attached a key

### Readiness behavior

Readiness returns:

- `enabled`
- `ready`
- `credentialMode`
- `credentialSource`
- `reason`
- `hasEnvironmentToken`
- `hasUserSecret`

For enterprise submissions, if Snyk is enabled but not ready, submission currently fails with `422` rather than silently degrading the planned provider set.

## Snyk runtime notes

The runtime is implemented in `wasp-app/src/server/lib/scanners/snykRuntime.ts`.

Current execution model:

- build SBOM input for the selected components
- execute Snyk CLI using `snyk sbom test --file="$VIBESCAN_BOM_PATH" --json` by default
- support runtime modes controlled by `SNYK_RUNTIME` (`local`, `ssh`, `mock`)
- pass credentials through provider-scoped resolution only
- normalize the response into the shared findings format with `source: 'snyk'`

Useful runtime settings:

- `SNYK_TOKEN`
- `SNYK_ORG_ID`
- `SNYK_TIMEOUT_MS`
- `SNYK_COMMAND`
- `SNYK_RUNTIME`

## ScanResult-based source breakdowns

The source of truth for provider breakdowns is `ScanResult.source`.

Current read paths intentionally aggregate from persisted `ScanResult` rows:

- scan detail -> `results_summary.counts_by_source`
- recent scans -> `counts_by_source`
- scan stats -> `by_source`
- dashboard metrics -> `vulnerabilities_by_source`

Compatibility fields still exist:

- `free_count` = `grype`
- `enterprise_count` = sum of all non-`grype` sources

These compatibility counts are derived views only. Any new provider work must keep source-level breakdowns authoritative.

## Settings/OpenAPI surface that depends on this model

The scanner access settings surface now exposes Snyk state through `/api/v1/settings/scanner-access`:

- `snyk_api_key_attached`
- `snyk_api_key_preview`
- `snyk_enabled`
- `snyk_ready`
- `snyk_ready_reason`
- `snyk_credential_source`
- `scanner_health.{johnny,snyk}`

That endpoint is the operator-facing readiness view for deciding whether enterprise scans can use the `grype + snyk` path.

## Rules for adding the next provider

When introducing another provider:

1. implement the provider in `wasp-app/src/server/lib/scanners/`
2. register it in the provider registry
3. extend planner rules in `providerSelection.ts`
4. persist a stable `ScanResult.source` enum value
5. expose readiness/health/credential behavior explicitly if the provider is optional
6. keep read models source-based; do not add new hardcoded `free vs enterprise vs X` branches

## Current risk boundary

The main thing to avoid is reintroducing assumptions that there are only two scanner buckets.

In particular:

- do not treat `enterprise_count` as a real provider
- do not infer expected providers from plan alone when `plannedSources` is available
- do not document OpenAPI or dashboard responses as if only `grype` and `codescoring-johnny` can exist
