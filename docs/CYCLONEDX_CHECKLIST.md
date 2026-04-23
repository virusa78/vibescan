# CycloneDX Implementation Checklist

## 0. Базовые договорённости
- [x] Зафиксировано, что все сканеры считаются источниками CycloneDX.
- [x] Зафиксированы поддерживаемые версии схемы: `1.4`, `1.5`, `1.6`.
- [ ] Опорные fixtures согласованы для текущей ветки (не полагаться на отсутствующий корневой `cyclone.json`).

## 1. Parser
- [x] Создан модуль parser для CycloneDX JSON.
- [x] Ошибки parser унифицированы (`parse_error`) с диагностикой.
- [x] Parser возвращает типизированный `ParsedCycloneDxDocument`.
- [ ] Добавлены целевые unit-тесты parser на edge cases и malformed payloads.

## 2. Validator
- [x] Добавлена schema validation CycloneDX.
- [x] Добавлены runtime-инварианты платформы.
- [x] При `validation_error` ingestion возвращает `rejected`.
- [ ] Добавлены отдельные unit/contract тесты validator.

## 3. Unifier
- [x] Создан unified DTO для `components` и `vulnerabilities`.
- [x] Нормализованы `severity`, `cvss`, `id` (`CVE/GHSA/OSV`), `cwe`, `purl`, `cpe`.
- [x] Сохранена трассируемость raw -> unified полей.
- [ ] Добавлены regression-тесты unifier на разные варианты CycloneDX.

## 4. M1 Runtime Integration
- [x] Введены runtime-флаги `shadow/cutover/rollback` для ingestion path.
- [x] Workers интегрированы с ingestion decision слоем (legacy vs unified components).
- [x] В scan result пишется `ingestionMeta` (режим, статус, unified stats, drift telemetry).
- [x] Report read path умеет читать unified stats при `cutover` с fallback на legacy.

## 5. Format Learning Loop
- [ ] Raw-артефакты каждого скана сохраняются для анализа в отдельном каталоге.
- [ ] Ведётся каталог неизвестных полей (`unknownFieldCatalog`) с triage.
- [ ] Для каждого нового поля проходит цикл: triage -> mapping rule -> тест.
- [ ] Обновления unifier backward-compatible.

## 6. Quality Gate перед cutover
- [ ] Unit + integration тесты для ingestion mode routing зелёные.
- [ ] Regression тесты на consistent findings totals между legacy и cutover.
- [ ] Документация rollout и rollback порогов обновлена.
- [ ] Нет критичных `validation_error/unify_error` в telemetry за прогон smoke-набора.

## 7. M2 Backlog (после M1)
- [ ] Contract fixtures по каждому scanner adapter.
- [ ] unknownFieldCatalog + mapping loop automation.
- [ ] Расширенные unifier regression suites.
