# CycloneDX-First Scanner Plan

## Цель
Сделать единый ingestion pipeline, где **все сканеры считаются источниками CycloneDX**, а различия между ними снимаются через слой `parser -> validator -> unifier`.

## Базовые допущения
- Canonical вход для платформы: `CycloneDX JSON`.
- Опорный пример: корневой `cyclone.json`.
- Поддерживаемые версии схемы: `1.4`, `1.5`, `1.6`.
- Любой scanner adapter обязан вернуть CycloneDX-документ (raw), даже если внутренне использует другой механизм.

## Обязательные компоненты пайплайна

### 1) Parser (обязателен)
Назначение:
- безопасный parse входного SBOM,
- нормализация базовой структуры (`metadata`, `components`, `vulnerabilities`, `dependencies`),
- единый формат ошибок парсинга.

Выход:
- `ParsedCycloneDxDocument`.

### 2) Validator (обязателен)
Назначение:
- schema validation по CycloneDX,
- дополнительные runtime-инварианты для нашего pipeline (например обязательность `bomFormat/specVersion`).

Правило:
- если документ невалиден, возвращается `validation_error` и дальнейшая оркестрация не запускается.

Выход:
- `ValidatedCycloneDxDocument`.

### 3) Unifier (обязателен)
Назначение:
- привести вариативные поля разных сканеров к единому DTO платформы,
- нормализовать severity/CVSS/CWE/CPE/PURL/references/fixes,
- сохранить traceability между unified-данными и raw-полями.

Выход:
- `UnifiedScanPayload`.

## PR-план внедрения

## PR-01: CycloneDX Contracts + DTO
Scope:
- ввести `ParsedCycloneDxDocument`, `ValidatedCycloneDxDocument`, `UnifiedScanPayload`;
- зафиксировать контракт ошибок: `parse_error`, `validation_error`, `unify_error`.

DoD:
- типы вынесены в отдельный модуль и используются как единственный контракт ingestion.

## PR-02: Parser
Scope:
- реализовать CycloneDX parser с безопасной обработкой больших JSON;
- унифицировать ошибки и source metadata (`scanner`, `toolVersion`, `ingestedAt`).

DoD:
- parser стабильно обрабатывает `cyclone.json` и тестовые фикстуры.

## PR-03: Validator
Scope:
- добавить schema validation (`1.4/1.5/1.6`);
- добавить runtime-валидацию платформенных инвариантов.

DoD:
- невалидные документы блокируются до запуска оркестратора.

## PR-04: Unifier
Scope:
- построить нормализацию в единый DTO для `components` и `vulnerabilities`;
- унифицировать severity/cvss/id references и source links.

DoD:
- одинаковые уязвимости из разных сканеров приходят в единый вид.

## PR-05: Scanner Adapters Contract Alignment
Scope:
- привести адаптеры (`grype`, `trivy`, `osv-scanner`, `snyk`, `blackduck`, etc.) к контракту "return CycloneDX";
- для адаптеров без прямого CycloneDX экспорта добавить слой конвертации в CycloneDX перед parser.

DoD:
- каждый адаптер в registry отдает CycloneDX raw-артефакт.

## PR-06: Persistence и Наблюдаемость Форматов
Scope:
- сохранять raw CycloneDX по каждому запуску сканера;
- логировать неизвестные/новые поля (`unknownFieldCatalog`);
- хранить telemetry: какой scanner и какая версия схемы что прислали.

DoD:
- есть база для постепенного расширения unifier без регрессий.

## PR-07: Эволюция Маппинга (Format Learning Loop)
Scope:
- внедрить процесс "новое поле -> triage -> mapping rule -> тест";
- добавить regression-наборы по каждому сканеру.

DoD:
- новые вариации CycloneDX добавляются без ломки старых кейсов.

## PR-08: Интеграция в Текущий Pipeline
Scope:
- встроить `parser/validator/unifier` в `scanOrchestrator` и workers;
- сохранить backward compatibility для текущих API/отчетов;
- включить rollout через feature flags (`UNIVERSAL_SCANNER_ENABLED`, `UNIVERSAL_SCANNER_SHADOW_MODE`).

DoD:
- новый слой работает в shadow и затем в cutover режиме с rollback-планом.

## Тестовая стратегия
- Unit: parser/validator/unifier по отдельности.
- Contract: фикстуры CycloneDX от разных сканеров.
- Integration: end-to-end ingestion через workers/queue.
- Regression: ранее встреченные raw-документы не ломаются после обновления маппинга.

## Риски и контроль
- Риск: разные сканеры по-разному заполняют CycloneDX поля. Контроль: strict parser + validator + unknown field catalog.
- Риск: ложные дубли/пропуски в унификации. Контроль: deterministic unifier + regression fixtures.
- Риск: регрессии при расширении маппинга. Контроль: format learning loop + обязательные contract tests.

## Связанный чек-лист
- `docs/CYCLONEDX_CHECKLIST.md`
