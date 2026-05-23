# GitHub App Validation Runbook

## Purpose
Короткий runbook для ручной проверки workspace-aware GitHub App integration и reusable VibeScan CI gate после кодового PR.

## Demo Script
Ниже готовый пошаговый сценарий, если нужно показать работу VibeScan в GitHub CI живьем.

### A. GitHub App Path: PR -> Webhook -> Check Run -> Report
#### A1. Подготовка installation и policy
1. Открой VibeScan и войди в workspace, к которому привязан GitHub App.
2. Перейди в `Settings -> GitHub Integration`.
3. Покажи, что installation уже связан с workspace.
4. Открой настройки installation и проверь три вещи:
   - `Run on push` включен
   - `Run on pull requests` включен
   - `fail PR on severity` выставлен на нужный порог, например `HIGH`
5. Объясни, что именно этот порог является policy source для CI decision.
6. При желании поменяй порог на другое значение и скажи, что workflow и webhook не меняются, меняется только policy.

#### A2. PR-поток и GitHub Check Run
1. В подключенном репозитории открой или обнови PR в разрешенной ветке.
2. Покажи, что GitHub получает check run от VibeScan.
3. Прямо проговори ожидаемую последовательность статусов:
   - `queued` означает, что webhook уже принят и scan поставлен в очередь
   - `in_progress` означает, что scan выполняется
   - `completed` означает, что VibeScan уже вернул итог проверки
4. Если это PR из fork, отдельно отметь, что webhook-путь его намеренно игнорирует.
5. Для обычного PR открой `details_url` из check run и перейди на scan details в VibeScan.
6. Покажи, что ссылка ведет именно на тот scan, который создался из webhook.

#### A3. Report и triage в VibeScan
1. Переключись на report страницу этого scan.
2. Покажи карточку `CI Decision`.
3. Расшифруй для аудитории каждое поле:
   - `PASS` или `FAIL` показывает итоговую блокировку merge
   - `reason` объясняет, почему принято именно это решение
   - `blocking findings` показывает, сколько находок реально блокируют PR
   - `blocking findings by source` показывает, какой scanner что нашел
   - `effective threshold` показывает, какой порог реально использовался
   - `scan/report links` позволяют прыгнуть обратно к артефактам проверки
4. Если CI decision `FAIL`, открой findings внизу и покажи, какие находки дали блокирующий статус.
5. Если CI decision `PASS`, покажи, что при текущем пороге блокирующих находок нет.
6. Если хочешь продемонстрировать policy control, поменяй `fail PR on severity` в installation и повтори шаги A2-A3.

### B. Reusable Actions Path: Workflow -> API Scan -> Poll -> Gate Result
1. В consumer repo добавь вызов `.github/workflows/vibescan-ci-gate.yml`.
2. Передай:
   - `repository_url`
   - `api_base_url`
   - `vibescan_api_key`
3. Запусти workflow на PR или вручную через `workflow_dispatch`, если он у тебя обёрнут.
4. Покажи шаг в GitHub Actions, где workflow:
   - отправляет scan в VibeScan
   - поллит статус до `done`
   - запрашивает CI decision
5. Покажи, что job:
   - проходит при `pass`
   - падает при `fail`
6. Открой step summary и покажи:
   - decision
   - threshold
   - blocking issues by source
   - ссылки на scan и report
7. Повтори запуск с другим `fail PR on severity` и покажи, что workflow меняет поведение без изменения YAML.

### C. What to Say During the Demo
1. GitHub App path нужен для repo-native асинхронной проверки без лишнего ручного шага.
2. Reusable Actions gate нужен, когда команда хочет явный CI fail в своем workflow.
3. Источник политики один: `fail PR on severity` на GitHub installation.
4. Fork PRs по webhook-пути игнорируются намеренно, чтобы не ломать conservative policy.

## Preconditions
- GitHub App env настроен:
  - `GITHUB_APP_ID`
  - `GITHUB_APP_SLUG`
  - `GITHUB_APP_PRIVATE_KEY`
  - `GITHUB_APP_WEBHOOK_SECRET`
- backend/frontend доступны
- у тестового пользователя есть доступ к нужному workspace
- GitHub App установлен хотя бы на один тестовый repository

## Validation Checklist

### 1. Workspace Context
- [ ] пользователь логинится и попадает в приложение
- [ ] в navbar виден workspace switcher
- [ ] переключение workspace меняет active workspace без server error

### 2. GitHub App Install / Connect
- [ ] в `Settings -> GitHub Integration` видна кнопка `Install GitHub App`
- [ ] install link открывает страницу GitHub App installation
- [ ] после установки можно получить installation ID
- [ ] installation ID успешно привязывается к active workspace
- [ ] linked installation появляется в списке installations

### 3. Installation Settings
- [ ] можно выбрать subset repositories
- [ ] можно включить/выключить `Run on push`
- [ ] можно включить/выключить `Run on pull requests`
- [ ] можно задать `target branches`
- [ ] можно задать `fail PR on severity`
- [ ] сохранение не падает и refetch показывает сохранённое состояние

### 4. Webhook Validation
- [ ] GitHub webhook отправляется на `/github/webhook`
- [ ] signature verification проходит
- [ ] `push` на разрешённый repo/branch создаёт scan
- [ ] `push` на запрещённый branch не создаёт scan
- [ ] `pull_request` на разрешённый repo/branch создаёт scan
- [ ] duplicate delivery не создаёт duplicate scan
- [ ] fork PR events игнорируются с reason `fork_pr_not_supported_yet`

### 5. Private Repository Path
- [ ] private repo scan стартует без PAT
- [ ] installation token path реально используется
- [ ] scanner execution не падает на clone/auth step

### 6. GitHub Check Runs
- [ ] webhook-enqueued scan создаёт `queued` check run
- [ ] scan start обновляет check run в `in_progress`
- [ ] successful completion обновляет check run в `completed/success`
- [ ] failure path обновляет check run в `completed/failure`
- [ ] `details_url` ведёт на `VibeScan /scans/:scanId`

### 7. Reusable Actions Gate
- [ ] consumer repo вызывает `.github/workflows/vibescan-ci-gate.yml` через `workflow_call`
- [ ] workflow submits scan with API key and `inputType: github`
- [ ] workflow polls `/api/v1/scans/{scanId}` until status is `done`
- [ ] workflow fetches `/api/v1/reports/{scanId}/ci-decision`
- [ ] failed decisions stop the job and print scan/report links in the step summary
- [ ] linked installation policy changes the effective threshold without changing the workflow

## Known Expected Gaps
- manual installation ID linking всё ещё остаётся fallback path
- fork PR policy intentionally conservative: fork PRs are ignored by the GitHub App webhook path
- live validation нужна отдельно от unit/integration coverage
