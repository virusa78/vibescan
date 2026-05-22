# M6-PR3B.5 Implementation Act (Merge-Ready)

## Metadata
- Date (UTC): `2026-04-23`
- Branch: `codex/m5-rollout-hardening`
- Base: `main`
- Status: `merge-ready`

## Completed Work Ledger
- `M6-PR1`: реализованы route-level crash fallback и locale bootstrap.
- `M6-PR2`: завершены usage tracking и API key details surface без изменения публичных operation contracts.
- `M6-PR3A`: выполнен backend-first OpenAPI hardening для `/api/v1/*` (manifest/fallback/policy gate).
- `M6-PR3B.1`: закрыт in-scope `UX_spec.md` closure sweep; открыты только `POST-LAUNCH`/future batches по договоренности.
- `M6-PR3B.2`: выполнен targeted regression pass по dashboard/reports/webhooks/settings/api-keys.
- `M6-PR3B.3`: внесен fix-only webhooks UX hardening (empty/loading states + accessibility label).
- `M6-PR3B.4`: пройден финальный merge-ready verification bundle, включая repaired `useScanPolling` harness.
- `M6-PR3B.5`: синхронизированы `plan.md` и актуальные docs по provider-aware scanner модели, выпущен этот merge-ready handoff акт.

## Verification Canon
- Required gate bundle (single command):
  - `npm run verify:m6:pr3b4`
- Gate status:
  - `npm run lint` -> `PASS` (warnings only; no errors).
  - `npm run openapi:contract` -> `PASS` (`[openapi:contract] OK`, route parity `41/41`).
  - `npm run test:targeted:pr3b4` -> `PASS` (`7 suites`, `33 tests`).
  - `npm run test:use-scan-polling` -> `PASS` (`1 suite`, `8 tests`).
  - `cd wasp-app && wasp build` -> `PASS`.

## Scope Guardrails
- In scope:
  - doc sync и handoff contract для M6 merge-ready состояния.
  - фиксация verification canon и единого источника evidence.
  - синхронизация scanner/OpenAPI документации с текущей моделью: `plannedSources`, `ScanResult` source breakdowns, `grype + snyk` parallel path, manifest + `main.wasp` policy.
- Out of scope:
  - новые продуктовые фичи.
  - любые публичные API/operation contract изменения.
  - release/go-live orchestration.

## Residual Notes
- Non-blocking:
  - ESLint baseline still reports repository-wide warnings (`440`) but exits `0`.
  - `test:targeted:pr3b4` uses `--forceExit` to make the known open-handle baseline deterministic in CI/local runs.
- Blockers:
  - отсутствуют в рамках merge-ready handoff.

## Handoff Contract
1. Обновить рабочую ветку от `main` и разрешить возможные doc-level конфликты без расширения scope.
2. Если после обновления ветки меняется runtime/doc контекст, повторить `npm run verify:m6:pr3b4` и приложить новый timestamp evidence.
3. Подготовить commit и PR description в формате problem/solution/test evidence, с явным указанием статуса M6: `in progress`, `merge-ready handoff complete`.
4. В PR сослаться на sources of truth: `plan.md` (блоки `M6 Progress`, `M6 Status`, `M6-PR3B.4 Evidence`) и этот акт.
5. Для scanner/OpenAPI narrative использовать обновлённые docs: `docs/SCANNER_INTEGRATION_PLAN.md`, `docs/ARCHITECTURE.md`, `README.md`, `wasp-app/SWAGGER_SETUP.md`, `docs/SETTINGS_API_SPEC.md`.

## PR Handoff Runbook (Steps 1-5)

### 1) Sync + Scope Guard
- Input:
  - Текущая рабочая ветка и актуальный `main`.
  - Источник doc-only scope: `plan.md`, `docs/M6_PR3B5_IMPLEMENTATION_ACT.md`, `docs/CYCLONEDX_CHECKLIST.md`.
- Action:
  - Обновить ветку от `main` и убедиться, что изменения остаются в doc-only границах.
- Output:
  - Актуализированная ветка без расширения scope.
- Done condition:
  - В diff отсутствуют runtime/API/schema изменения.

### 2) Conditional Re-Verify
- Input:
  - Результат шага 1 и факт изменения контекста после sync/rebase.
- Action:
  - Если контекст изменился, выполнить `npm run verify:m6:pr3b4` и записать новый UTC run window.
- Output:
  - Актуальный verification artifact (при необходимости).
- Done condition:
  - Для измененного контекста есть свежий evidence window и gate status.

### 3) Commit
- Input:
  - Doc-only изменения по `M6-PR3B.5`.
- Action:
  - Подготовить Conventional Commit для doc sync + merge-ready handoff.
- Output:
  - Коммит с зафиксированным scope `M6-PR3B.5`.
- Done condition:
  - Коммит содержит только согласованные docs и не затрагивает продуктовый runtime.

### 4) PR Update
- Input:
  - Коммит шага 3 и действующий verification canon.
- Action:
  - Обновить PR description по шаблону:

```md
## Problem
Нужно зафиксировать M6 merge-ready handoff без закрытия M6 в Done.

## Solution
- Синхронизированы `plan.md` и `docs/M6_PR3B5_IMPLEMENTATION_ACT.md`.
- Зафиксирован PR-oriented runbook шагов 1-5.
- Обновлена архивная note-ссылка в `docs/CYCLONEDX_CHECKLIST.md`.

## Verification
- `npm run verify:m6:pr3b4` (если контекст менялся после sync/rebase).

## Evidence Source
- `plan.md` (`M6 Status`, `M6-PR3B.4 Evidence`)
- `docs/M6_PR3B5_IMPLEMENTATION_ACT.md`
```

- Output:
  - PR description с явными статусами `M6 in progress` и `merge-ready handoff complete`.
- Done condition:
  - PR narrative decision-complete, evidence source указан явно.

### 5) Merge After Review
- Input:
  - Одобренный PR после review.
- Action:
  - Выполнить merge без запуска нового продуктового планирования в M6.
- Output:
  - Смёрженный PR с сохранённым doc-only scope.
- Done condition:
  - Handoff завершён, M6 остаётся `in progress` до отдельного done-решения.

## Next Code PR Split

### Code PR 1
- Focus:
  - contract/infrastructure hardening.
- Includes:
  - openapi contract tooling, CI wiring, swagger policy/spec generation, and script/lockfile plumbing.
- Excludes:
  - UI/runtime surface changes.
  - schema/migration changes.

### Code PR 2
- Focus:
  - product/runtime UI fixes.
- Includes:
  - API keys, dashboard, reports, webhooks, client bootstrap, API helper, and polling stabilization.
- Excludes:
  - schema/migration changes.
  - contract tooling changes already owned by PR 1.

### Code PR 3
- Focus:
  - schema/migration alignment and review follow-ups.
- Includes:
  - Prisma/schema copies, migration artifacts, and any fixes required after review of PR 1 and PR 2.
- Required gate:
  - run code review on PR 1 and PR 2 before starting PR 3.
- Verification:
  - re-run `npm run verify:m6:pr3b4` only if schema/contracts or other verification inputs change.
