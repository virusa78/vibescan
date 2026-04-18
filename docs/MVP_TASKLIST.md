# MVP Task List (реалистичный план доведения до запуска)

## 1) Цель MVP

Пользовательский сценарий, который обязан работать стабильно:

1. Пользователь регистрируется/логинится.
2. Открывает Dashboard.
3. Создаёт новый скан.
4. Запускает скан по SBOM или GitHub URL.
5. Получает финальный статус скана (`done`/`error`, без зависаний).
6. Видит результаты в Dashboard и Scan Details.
7. Видимость деталей отчёта корректно зависит от плана (paywall).

---

## 2) Definition of Done (обязательно для статуса «MVP готов»)

- Все P0-задачи ниже закрыты.
- Скан никогда не зависает в `scanning` навсегда.
- Paywall нельзя обойти через клиентские поля.
- Webhook-события соответствуют фактическим переходам статусов.
- `npm run build` проходит.
- `npm test` проходит без ручных workaround.
- `npm run test:e2e` проходит по smoke-сценариям.
- Документация не содержит ложных заявлений «100% ready», пока gate не зелёный.

---

## 3) P0 (критический контур запуска)

## P0-1. Починить state machine скана
- **Проблема:** scan может зависнуть в `scanning`.
- **Файлы:**  
  `wasp-app/src/server/workers/freeScannerWorker.ts`  
  `wasp-app/src/server/workers/enterpriseScannerWorker.ts`
- **Сделать:** учитывать ожидаемые сканеры и переводить скан в terminal-state при завершении ожидаемого набора.
- **Критерий:** ни один сценарий (free/pro/enterprise) не остаётся в бесконечном `scanning`.

## P0-2. Убрать trust к `plan_tier` из клиента
- **Проблема:** paywall можно обойти.
- **Файлы:**  
  `wasp-app/src/server/operations/scans/submitScan.ts`  
  `wasp-app/src/server/operations/reports/getReport.ts`
- **Сделать:** план брать только с сервера (подписка пользователя), не из payload клиента.
- **Критерий:** подмена `plan_tier` в запросе не влияет на доступ к деталям.

## P0-3. Исправить контракт с orchestrator
- **Проблема:** в `planAtSubmission` уходит `result.status`.
- **Файлы:**  
  `wasp-app/src/server/operations/scans/submitScan.ts`  
  `wasp-app/src/server/operations/scans/orchestrator.ts`
- **Сделать:** передавать реальный tier/plan snapshot.
- **Критерий:** enterprise-ветка включается только по реальному плану.

## P0-4. Исправить webhook event lifecycle
- **Проблема:** `scan_complete` шлётся на submit.
- **Файлы:**  
  `wasp-app/src/server/operations/scans/submitScan.ts`  
  места финализации в workers/orchestrator
- **Сделать:** эмитить terminal events только по фактическому завершению/ошибке.
- **Критерий:** события webhook отражают реальный статус скана.

## P0-5. Исправить retry attempt в webhook delivery
- **Проблема:** `attemptNumber` не растёт корректно.
- **Файлы:**  
  `wasp-app/src/server/services/webhookEventEmitter.ts`  
  `wasp-app/src/server/workers/webhookDeliveryWorker.ts`
- **Сделать:** использовать фактические попытки job (`attemptsMade + 1`) и правильно обновлять delivery.
- **Критерий:** история ретраев и exhausted-логика корректны.

## P0-6. Убрать hardcoded путь в Grype scanner
- **Проблема:** непереносимый путь `/home/virus/vibescan/...`.
- **Файл:** `wasp-app/src/server/lib/scanners/grypeScannerUtil.ts`
- **Сделать:** временные файлы через `os.tmpdir()`/конфигурируемую writable директорию.
- **Критерий:** сканер работает в другой среде без path hacks.

## P0-7. Исправить роуты UI (`/new-scan` vs `/scans/new`)
- **Проблема:** CTA ведут в несуществующие маршруты.
- **Файлы:**  
  `wasp-app/src/dashboard/DashboardPage.tsx`  
  `wasp-app/src/client/components/common/ScanTable.tsx`  
  `wasp-app/src/client/components/common/EmptyState.tsx`
- **Сделать:** единый маршрут создания скана (`/new-scan`) во всех CTA.
- **Критерий:** из Dashboard пользователь всегда попадает на рабочую страницу нового скана.

## P0-8. Синхронизировать E2E с реальным UI и сделать test gate валидным
- **Проблема:** тесты ждут `data-testid`, которых нет; `npm test` нестабилен.
- **Файлы:**  
  `test/e2e-wasp/*.ts`  
  `wasp-app/src/**/*.{ts,tsx}`  
  `playwright.config.ts` / `playwright.wasp.config.ts` / `package.json`
- **Сделать:**  
  - добавить стабильные селекторы в UI,  
  - выровнять assertions с фактическим paywall-поведением,  
  - оставить один канонический Playwright config,  
  - привести `npm test` к детерминированному проходу.
- **Критерий:** smoke E2E проходит стабильно, root test команда зелёная.

---

## 4) P1 (функциональное завершение входов MVP)

## P1-1. GitHub scan: довести до реального выполнения
- **Проблема:** сейчас в основном валидация/заглушки.
- **Файлы:**  
  `wasp-app/src/server/services/inputAdapterService.ts`  
  `wasp-app/src/server/operations/scans/submitScan.ts`  
  соответствующие worker paths
- **Сделать:** извлечение компонентов + запуск pipeline для GitHub URL.
- **Критерий:** реальный GitHub URL приводит к результатам в Dashboard/Report.

## P1-2. ZIP: либо полноценно реализовать, либо временно скрыть из MVP
- **Проблема:** 501-path ломает ожидания.
- **Решение для MVP:**  
  - либо рабочая реализация,  
  - либо убрать option из UI до реализации.
- **Критерий:** пользователь не упирается в «мертвую» функцию.

## P1-3. Очистить противоречия в документации
- **Сделать:** синхронизировать README/отчёты с фактическим состоянием кода.
- **Критерий:** нет claim’ов о готовности без прохождения gate.

---

## 5) Рекомендуемый порядок выполнения

1. P0-1, P0-2, P0-3 (ядро корректности статусов и плана).
2. P0-4, P0-5 (корректные webhook события и retry).
3. P0-6, P0-7 (переносимость и UX-навигация).
4. P0-8 (валидный test gate).
5. P1-1 (GitHub реальный путь).
6. P1-2 (ZIP решение).
7. P1-3 (документация).

---

## 6) Release Gate (финальная проверка)

```bash
npm run build
npm test
npm run test:e2e
```

Плюс ручной smoke:

1. Новый пользователь → login.
2. Dashboard.
3. New Scan (SBOM, затем GitHub).
4. Статус доходит до terminal-state.
5. Отчёт/детали отображаются согласно плану.

Только после этого — выставлять статус «MVP готов».
