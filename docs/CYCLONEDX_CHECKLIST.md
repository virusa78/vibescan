# CycloneDX Implementation Checklist

## 0. Базовые договорённости
- [ ] Зафиксировано, что все сканеры считаются источниками CycloneDX.
- [ ] Опорный пример `cyclone.json` принят как базовый референс.
- [ ] Зафиксированы поддерживаемые версии схемы: `1.4`, `1.5`, `1.6`.

## 1. Parser
- [ ] Создан модуль parser для CycloneDX JSON.
- [ ] Ошибки parser унифицированы (`parse_error`) с диагностикой.
- [ ] Parser возвращает типизированный `ParsedCycloneDxDocument`.
- [ ] Добавлены unit-тесты parser на `cyclone.json` и edge cases.

## 2. Validator
- [ ] Добавлена schema validation CycloneDX.
- [ ] Добавлены runtime-инварианты платформы.
- [ ] При `validation_error` orchestration не запускается.
- [ ] Добавлены unit/contract тесты validator.

## 3. Unifier
- [ ] Создан unified DTO для `components` и `vulnerabilities`.
- [ ] Нормализованы `severity`, `cvss`, `id` (`CVE/GHSA/OSV`), `cwe`, `purl`, `cpe`.
- [ ] Сохранена трассируемость raw -> unified полей.
- [ ] Добавлены regression-тесты unifier на разные варианты CycloneDX.

## 4. Adapter Contract
- [ ] Для каждого scanner adapter зафиксирован контракт "return CycloneDX raw".
- [ ] Для адаптеров без нативного CycloneDX добавлен слой конвертации.
- [ ] Добавлены contract fixtures по каждому адаптеру.

## 5. Format Learning Loop
- [ ] Raw-артефакты каждого скана сохраняются для анализа.
- [ ] Ведётся каталог неизвестных полей (`unknownFieldCatalog`).
- [ ] Для каждого нового поля проходит цикл: triage -> mapping rule -> тест.
- [ ] Обновления unifier backward-compatible.

## 6. Интеграция и rollout
- [ ] `parser/validator/unifier` встроены в `scanOrchestrator` и workers.
- [ ] Сохранена совместимость текущих API/отчётов.
- [ ] Включён `shadow mode` с метриками расхождений.
- [ ] Подготовлен cutover + rollback сценарий.

## 7. Quality Gate перед merge
- [ ] Unit + contract + integration тесты зеленые.
- [ ] Нет неразобранных неизвестных полей без triage.
- [ ] Документация по новым mapping rules обновлена.
