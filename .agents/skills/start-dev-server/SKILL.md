---
name: start-dev-server
description: Start the Wasp dev server and set up full debugging visibility. This includes running the server (with access to logs), and connecting browser console access so the agent can see client-side errors. Essential for any development or debugging work.
---

## Project-Specific Flow (VibeScan)

Use this repository's managed Wasp contour, not raw `wasp start db`.

### Step 0: Confirm start mode

Ask whether to:
- run locally in the current agent session (preferred for autonomous debugging), or
- have the user run commands in their own terminal and paste logs.

### Step 1: Start the VibeScan Wasp contour

From repo root, run:

```bash
npm run wasp:up
```

This wrapper (`scripts/wasp-dev.sh up`) does all of the following:
- starts Docker infra (`postgres`, `redis`, `minio`),
- loads env from `wasp-app/.env.server` and root `.env`,
- attempts `npx wasp db migrate-dev --name dev_auto_sync`,
- launches `npx wasp start` and waits for readiness.

### Step 2: Verify readiness and logs

Run:

```bash
bash ./scripts/wasp-dev.sh status
curl -fsS http://127.0.0.1:3001/health
curl -fsS http://127.0.0.1:3000
```

Primary log file:

`./.logs/wasp-dev/wasp-dev.log`

### Step 3: Stop when done

```bash
npm run wasp:down
```

### Step 4: Fallback mode (only if needed)

For direct foreground debugging:

```bash
npm run wasp:dev
```

If schema/entity changes are pending, run migration with descriptive name:

```bash
cd wasp-app
npx wasp db migrate-dev --name <descriptive-name>
```

### Step 5: Browser console visibility

Prefer Chrome DevTools MCP so the agent can inspect console errors and failed network requests during UI debugging. If unavailable, require pasted browser console logs from the user.
