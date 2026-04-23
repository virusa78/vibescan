# Requirements/Design Gap Analysis (VibeScan)

Source specs:
- `.kiro/specs/vibescan/requirements.md`
- `.kiro/specs/vibescan/design.md`

Codebase baseline analyzed:
- Backend routes/handlers/services/workers/queues
- Frontend wiring for dashboard/settings/auth
- Existing test suites in `test/unit`, `test/integration`, `test/e2e`

## Executive summary

- **Covered:** 4 / 30 requirements
- **Partial:** 22 / 30 requirements
- **Missing:** 1 / 30 requirements
- **Conflict (implemented behavior diverges from spec):** 3 / 30 requirements

Top blockers to close first:
1. Missing GitHub App event pipeline (Req 14).
2. Security/runtime gaps around source isolation and webhook data model (Req 13/16/18).
3. Product behavior conflicts around locked/delta paywall (Req 12/23).

---

## Requirements coverage matrix (Req 1..30)

| Req | Status | Evidence (implementation) | Gap / mismatch | Recommended action |
|---|---|---|---|---|
| 1. User registration/auth | **Partial** | `src/services/authService.ts`, `src/handlers/authHandlers.ts` | No verification email send on register; tokens/rotation/401 are present. | Add verification-email flow hook in register path + tests. |
| 2. API key management | **Covered** | `authService.generateApiKey/verifyApiKey/revokeApiKey/listApiKeys`, `handlers/apiKeyHandlers.ts` | Meets prefix/hash/one-time return/revoke/list behavior. | Keep as baseline; add contract assertions for response shape stability. |
| 3. Quota management | **Covered** | `quotaService.ts`, `redis/quota.ts`, `scanOrchestrator.submitScan` | Check/consume/reject/refund are implemented. | Add stronger integration tests for race/concurrency. |
| 4. Scan submission (source ZIP) | **Partial** | `scanHandlers.submitScanHandler`, `inputAdapterService.fromSourceZip` | Missing explicit 50MB validation and 413 handling; extraction not container-isolated per spec. | Enforce max-size before processing + return 413 + isolated runtime path. |
| 5. SBOM upload | **Partial** | `inputAdapterService.validateCycloneDX/fromCycloneDX`, `scanHandlers.ts` | Validation is structural, not JSON Schema v1.4/1.5/1.6 compliant. | Integrate real CycloneDX schema validation and version checks. |
| 6. GitHub submission | **Partial** | `scanHandlers.ts`, `inputAdapterService.fromGithubUrl` | No installation_id auth check; no GitHub App token path; repo/ref validation minimal. | Implement GitHub App authorization flow and strict repo/ref validation. |
| 7. Dual-scanner architecture | **Partial** | `scanOrchestrator.submitScan`, `queues/config.ts` | Parallel queueing exists, but status shifts to `scanning` immediately after enqueue (spec emphasizes queued/pending stage). | Align status lifecycle and assert pending→scanning transitions deterministically. |
| 8. Free scanner worker | **Partial** | `workers/freeScannerWorker.ts` | Grype not run in isolated Docker (`--network=none`, etc.); scan not piped via stdin as required. | Move scan execution into isolated container pipeline. |
| 9. Enterprise scanner worker | **Partial** | `workers/enterpriseScannerWorker.ts`, `queues/config.ts` | Locking/polling implemented; queue worker concurrency is 1 (spec target is max 3 parallel). | Restore effective max concurrency=3 while preserving license guardrails. |
| 10. Delta engine | **Partial** | `services/diffEngine.ts`, `scanOrchestrator.computeDelta`, `reportService.ts` | Diff logic exists, but orchestrator uses simplified delta path not fully unified with DiffEngine ranking semantics. | Use DiffEngine consistently for persisted delta computation. |
| 11. Report full view | **Partial** | `services/reportService.ts`, `handlers/reportHandlers.ts` | JSON/CI and 202 PDF job id are present; PDF content generation pipeline is stubbed. | Implement async PDF job worker and output generation contract. |
| 12. Report locked view | **Conflict** | `reportService.buildLockedView` delegates to full view | Current product code intentionally exposes full depth to all plans; spec expects locked starter behavior. | Decide canonical policy and update either spec or implementation. |
| 13. Webhook delivery | **Partial** | `services/webhookService.ts`, `queues/config.ts` | Backoff + signature header exist; data model inconsistent (`users.webhook_url` vs `webhooks` table), payload gating not aligned with spec. | Unify webhook source-of-truth on `webhooks` table and fix signing-secret storage/use. |
| 14. GitHub App integration events | **Missing** | No github handlers/service/routes found in `src/index.ts` and `src/services` | Installation/push/PR event pipeline absent. | Add GitHub webhook handlers + installation store + scan trigger flow. |
| 15. Billing integration | **Partial** | `services/billingService.ts`, `handlers/billingHandlers.ts` | Checkout/discount/webhooks exist; period-end vs deletion semantics need tighter contract guarantees. | Add contract tests for subscription lifecycle transitions and downgrade timing. |
| 16. Source code isolation security | **Partial** | `inputAdapterService.ts`, `freeScannerWorker.ts` comments | Spec-required container flags not enforced in actual adapter/worker execution path. | Implement real isolated container execution with explicit runtime flags. |
| 17. API key storage security | **Covered** | `authService.ts`, migration `007_create_api_keys_table.ts` | Hash-only storage and one-time raw key return are implemented. | Keep; add negative tests for key recovery impossibility. |
| 18. Data encryption | **Conflict** | `billingService` uses `pgp_sym_encrypt` for Stripe IDs; `api_keys.key_hash` uses bcrypt only | Spec/design asks pgcrypto for key_hash/signing_secret; implementation uses bcrypt hash (and webhook storage is inconsistent). | Reconcile cryptography policy in spec + implement consistent webhook secret encryption/decryption path. |
| 19. Queue architecture scalability | **Partial** | `queues/config.ts`, `index.ts` | Four queues exist; webhook/report worker processors are placeholders; enterprise worker concurrency differs from design table. | Implement real webhook/report workers + align queue concurrency policy. |
| 20. Error handling reliability | **Partial** | `scanOrchestrator.handleWorkerError`, `enterpriseScannerWorker` | Partial-result handling exists; error payload contracts (e.g., retry_after) not consistently surfaced. | Standardize error code payloads in handlers and worker propagation. |
| 21. Quota behavior | **Partial** | `scanOrchestrator.submitScan/cancelScan`, `quotaService.ts` | Core decrement/refund exists; cancellation does not verify “before execution” boundary explicitly. | Track execution-start state and gate refund accordingly. |
| 22. Plan snapshot at submission | **Covered** | `scanOrchestrator` stores `plan_at_submission`; used in report/webhook payload summaries | Behavior aligns with snapshot immutability goal. | Add regression tests for downgrade-during-scan scenarios. |
| 23. Delta paywall enforcement | **Conflict** | `reportService.buildLockedView` returns full view | Product currently runs “same depth for all tiers”, conflicting with spec paywall rules. | Decide policy and align both requirements and code. |
| 24. Regional pricing | **Partial** | `billingService` regional discount + `billing/regional-pricing` endpoint | Discount path present; metadata/visibility expectations only partially enforced. | Add explicit metadata + response contracts + tests. |
| 25. Input validation | **Partial** | `scanHandlers.ts`, `inputAdapterService.ts`, `apiKeyHandlers.ts` | ZIP size/format checks, strict GitHub ref format, and schema-grade SBOM validation incomplete. | Centralize validators and enforce full contract. |
| 26. Pagination/filtering | **Partial** | `scanHandlers.listScansHandler`, `scanOrchestrator.listScans` | Status/input_type filtering present; date-forward filter missing. | Add `fromDate` (or equivalent) filter and tests. |
| 27. Ownership verification | **Partial** | `scanHandlers.getScanStatusHandler`, `reportService.getScanWithOwnership`, `webhookService.listDeliveries` | Ownership checks mostly present; not all ownership checks use “404 not 403” anti-enumeration convention. | Normalize ownership failure semantics across handlers. |
| 28. Error messages | **Partial** | Mixed error formats across handlers/middleware | Not all endpoints return standardized `{error, validation_errors}` and domain fields (`repo`, `retry_after`). | Introduce shared error formatter and migrate handlers. |
| 29. Scan cancellation | **Partial** | `scanOrchestrator.cancelScan`, `scanHandlers.cancelScanHandler` | Status/refund + 204 implemented; queue job revocation step is not explicit. | Add queue-job revoke and conflict handling for already-running jobs. |
| 30. Report formats | **Partial** | `reportHandlers.ts`, `reportService.ts` | `json/summary` and 202 PDF job id exist; completion email-link flow not implemented. | Implement PDF completion notification (email or equivalent) + tests. |

---

## Design-level gaps (from `design.md`)

| Design area | Current status | Evidence | Gap |
|---|---|---|---|
| GitHub integration service | Missing | No dedicated GitHub service/handlers/routes in `src/services`/`src/handlers`/`src/index.ts` | Design sections for installation/push/PR flows are not implemented end-to-end. |
| Queue worker completeness | Partial | `src/queues/config.ts` has placeholder processors for webhook/report queues | Design expects full async delivery/report pipelines; runtime is stubbed for 2 queues. |
| Enterprise queue concurrency model | Partial/conflict | `getWorkerConfigs()` sets enterprise concurrency to `1` | Design table says enterprise queue supports 3 concurrent workers max. |
| Source isolation controls | Partial | `inputAdapterService.ts` and `freeScannerWorker.ts` execute local commands directly | Design security section requires strict container isolation flags. |
| Webhook data model consistency | Partial/conflict | `webhookService` uses `users.webhook_url` and `webhook_deliveries.signing_secret`, while migrations define `webhooks.signing_secret_encrypted` | Storage/lookup/signing model is inconsistent with schema/design. |
| Paywall/report policy | Conflict | `reportService.buildLockedView()` returns full report | Design assumes locked starter delta behavior, code currently does not. |
| Error contract consistency | Partial | Multiple ad-hoc response payload shapes in handlers | Design/requirements call for consistent domain error contracts. |
| Deployment/monitoring fidelity | Partial | K8s manifests and metrics exist, but some runtime worker flows are placeholders | Operational design claims exceed effective runtime behavior in some paths. |

---

## Prioritized remediation backlog

### P0 (must fix first)
1. Implement GitHub App event pipeline (Req 14).
2. Resolve paywall policy conflict (Req 12/23) and align spec + code.
3. Fix webhook model consistency (table usage, signing secret storage, payload policy).
4. Enforce source isolation runtime for ZIP/GitHub processing (Req 16).

### P1
1. Complete webhook/report queue processors (Req 19/30).
2. Add missing validation contracts (ZIP size 50MB, CycloneDX schema, GitHub ref format).
3. Normalize error contracts and ownership-failure semantics.
4. Add date filtering for scans and explicit queue-revoke cancellation semantics.

### P2
1. Harden billing lifecycle contract tests (period-end/cancel behavior).
2. Unify delta computation path through DiffEngine only.
3. Expand integration/e2e coverage matrix directly against Req 1..30.

---

## Suggested execution order for next implementation cycle

1. **Spec decision pass:** close policy conflicts (locked/full delta, encryption interpretation).
2. **Runtime security pass:** source isolation + webhook model fixes.
3. **Feature completion pass:** GitHub events, queue processors, PDF completion notification.
4. **Contract hardening pass:** validation/error/ownership normalization + tests.

