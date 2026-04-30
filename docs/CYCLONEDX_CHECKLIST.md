# CycloneDX Implementation Checklist

## Note
- Active non-CycloneDX work is tracked in `plan.md` under M6.
- Final non-CycloneDX M6 merge-ready handoff is captured in `docs/M6_PR3B5_IMPLEMENTATION_ACT.md`.
- This checklist remains the CycloneDX archive and source of truth for M1-M5.

## 0. Базовые договорённости
- [x] Зафиксировано, что все сканеры считаются источниками CycloneDX.
- [x] Зафиксированы поддерживаемые версии схемы: `1.4`, `1.5`, `1.6`.
- [x] Опорные fixtures согласованы для текущей ветки (manifest + scanner-specific fixture set в `test/fixtures/cyclonedx`).

## 1. Parser
- [x] Создан модуль parser для CycloneDX JSON.
- [x] Ошибки parser унифицированы (`parse_error`) с диагностикой.
- [x] Parser возвращает типизированный `ParsedCycloneDxDocument`.
- [x] Добавлены целевые unit/contract тесты parser на fixture-manifest наборе.

## 2. Validator
- [x] Добавлена schema validation CycloneDX.
- [x] Добавлены runtime-инварианты платформы.
- [x] При `validation_error` ingestion возвращает `rejected`.
- [x] Добавлены отдельные unit/contract тесты validator (`invalid-missing-bomformat` fixture).

## 3. Unifier
- [x] Создан unified DTO для `components` и `vulnerabilities`.
- [x] Нормализованы `severity`, `cvss`, `id` (`CVE/GHSA/OSV`), `cwe`, `purl`, `cpe`.
- [x] Сохранена трассируемость raw -> unified полей.
- [x] Добавлены regression-тесты unifier на golden fixtures и legacy/cutover totals consistency.

## 4. M1 Runtime Integration
- [x] Введены runtime-флаги `shadow/cutover/rollback` для ingestion path.
- [x] Workers интегрированы с ingestion decision слоем (legacy vs unified components).
- [x] В scan result пишется `ingestionMeta` (режим, статус, unified stats, drift telemetry).
- [x] Report read path умеет читать unified stats при `cutover` с fallback на legacy.

## 5. Format Learning Loop
- [x] Raw-артефакты ingestion сохраняются в S3-first storage и пишут только metadata-ссылки в `ingestionMeta.artifacts[]`.
- [x] Ведётся каталог неизвестных полей (`unknownFieldCatalog`) с triage.
- [x] Для каждого нового поля проходит цикл: triage -> mapping rule -> тест.
- [x] Обновления unifier backward-compatible.
- [x] Добавлен retention baseline (TTL + cleanup runner + capture kill switch).

## 6. Quality Gate перед cutover
- [x] Unit тесты для ingestion mode routing и gate logic зелёные.
- [x] Regression тесты на consistent findings totals между legacy и cutover.
- [x] Документация rollout/rollback порогов обновлена (`VIBESCAN_CYCLONEDX_DRIFT_RATE_THRESHOLD=0.10` + rollback-safe gate).
- [x] Gate блокирует promotion при `validation_error/unify_error` и при drift `> 0.10`.
- [x] Upload failures artifacts фиксируются warning-ами и не роняют scan completion.

## 7. M2 Backlog (после M1)
- [x] Contract fixtures по scanner adapters (free + enterprise + invalid).
- [x] unknownFieldCatalog + mapping loop automation.
- [x] Расширенные unifier regression suites.

## 8. M3 Canary Rollout
- [x] Canary decision engine: `allow_promote | block_promote | rollback_required`.
- [x] Stage progression зафиксирован: `shadow_smoke -> canary_cutover_cohort -> expand_cohort`.
- [x] Rollback имеет приоритет и блокирует canary promotion.
- [x] Runbook для операторов добавлен (`docs/CYCLONEDX_M3_RUNBOOK.md`).
- [x] Smoke automation пишет evidence (`json + markdown`) по M3 gate-критериям.

## 9. M4 Staging-First Production Cutover Readiness
- [x] Persisted rollout state for `shadow_smoke -> canary_cutover_cohort -> expand_cohort -> ready_for_prod`.
- [x] Per-scanner gate snapshots linked to `scanResult` and `ingestionMeta`.
- [x] Aggregated staging SLO gate with blocker-errors `validation_error|unify_error` and drift threshold `0.10`.
- [x] Rollback-priority state blocks promotion regardless of other signals.
- [x] Acceptance automation writes `docs/CYCLONEDX_M4_EVIDENCE.json` and `docs/CYCLONEDX_M4_REPORT.md`.
- [x] Operator runbook and schema contract published for M4.
- Local DB migration application is still pending because `wasp db migrate-dev` hits Prisma's non-interactive prompt, but the generated schema and acceptance flow are in place.

## 10. M5 Rollout Hardening & Deployability
- [x] Empty staging windows fail closed with `block_promote`.
- [x] Empty-window decision reason is deterministic and machine-readable (`empty_window_no_observed_data`).
- [x] Acceptance runner exits non-zero on empty windows and still emits a blocked evidence pack.
- [x] New rollout tables/enums have a real `migration.sql` under `wasp-app/migrations/`.
- [x] Fresh-db migration path is verified without ad-hoc schema repair.
- [x] M5 operator runbook published (`docs/CYCLONEDX_M5_RUNBOOK.md`).
- [x] Rollback auto-recovery stays enabled and unchanged; later healthy scans may overwrite rollback state again.
