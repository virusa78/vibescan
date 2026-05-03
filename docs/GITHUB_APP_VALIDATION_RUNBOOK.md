# GitHub App Validation Runbook

## Purpose
Короткий runbook для ручной проверки workspace-aware GitHub App integration после кодового PR.

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

## Known Expected Gaps
- manual installation ID linking всё ещё остаётся fallback path
- fork PR policy пока intentionally conservative
- live validation нужна отдельно от unit/integration coverage
