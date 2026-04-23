# Requirements → Test Coverage Matrix (Bootstrap)

This is the first P2 bootstrap pass to map Req 1..30 to current automated tests.
Legend:
- **Strong**: direct contract/behavior assertions exist.
- **Partial**: some assertions exist, but not full acceptance.
- **Missing**: no direct automated assertion yet.

| Req range | Area | Current tests | Coverage | Gap to close |
|---|---|---|---|---|
| 1, 2 | Auth + API keys | `test/e2e/api.test.ts` (auth/api-keys), `test/e2e/auth-redirect.test.ts` | Strong | Add negative ownership enumeration checks (404 vs 403 policy) |
| 3, 21 | Quota behavior | `test/unit/property-tests.test.ts` (Property 1,2,19) | Partial | Add concurrency/race integration with real Redis+DB path |
| 4, 5, 6, 25 | Input validation & submission | `test/e2e/api.test.ts` scans, `property-tests` Property 13 | Partial | Add strict ZIP 50MB/413, CycloneDX schema, GitHub repo/ref format tests |
| 7, 8, 9, 19 | Orchestration/workers/queues | `property-tests` 10,15,15.1; `integration-tests` full flow | Partial | Add real queue processor behavior tests for webhook/report workers |
| 10, 12, 23 | Delta/paywall logic | `property-tests` 3,4, DiffEngine block | Partial | Add end-to-end assertion report payload by plan across JSON/webhook |
| 11, 30 | Reports formats | `test/integration/reports-contract-tests.test.ts` | Partial | Add async PDF completion path and notification contract tests |
| 13, 18 | Webhook/security model | `property-tests` 8,9,20 | Partial | Add DB model consistency tests for `webhooks`/secret storage path |
| 14 | GitHub App event pipeline | `integration-tests` (simulated) | Missing | Add real route/handler tests once pipeline is implemented |
| 15, 24 | Billing lifecycle + regional pricing | `test/unit/billingService.test.ts`, `test/e2e/api.test.ts` regional pricing | Partial | Add checkout → subscription state transition integration tests |
| 16 | Source isolation runtime | `property-tests` 5 (source assertions) | Partial | Add runtime execution tests for container isolation flags |
| 17 | API key secure storage | `property-tests` 6 | Partial | Add non-recoverability + DB shape contract tests |
| 20, 28 | Error contracts | `test/e2e/api.test.ts` error checks | Partial | Centralize error payload assertions across handlers |
| 22 | Plan snapshot at submission | `property-tests` 3 | Partial | Add downgrade-during-scan integration scenario |
| 26 | Pagination/filtering | `test/e2e/api.test.ts` scans + fromDate | Partial | Add cursor pagination continuity assertions |
| 27, 29 | Ownership + cancel semantics | `property-tests` 7; handler behavior checks | Partial | Add queue revoke + anti-enumeration contracts |

## Next P2 action

Promote this bootstrap matrix into a strict Req 1..30 row-level checklist with:
1. exact test IDs (file + case name),
2. runtime layer tag (unit/integration/e2e),
3. explicit acceptance status (`pass`, `partial`, `missing`).
