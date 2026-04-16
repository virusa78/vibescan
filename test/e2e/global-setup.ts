import type { FullConfig } from '@playwright/test';
import { spawn } from 'node:child_process';
import { once } from 'node:events';

const API_URL = process.env.API_URL || 'http://127.0.0.1:3001';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://127.0.0.1:3000';
const CHECK_TIMEOUT_MS = Number(process.env.E2E_PRECHECK_TIMEOUT_MS || 4000);
const RETRY_COUNT = Number(process.env.E2E_PRECHECK_RETRIES || 5);
const RETRY_DELAY_MS = Number(process.env.E2E_PRECHECK_RETRY_DELAY_MS || 1000);
const STARTUP_TIMEOUT_MS = Number(process.env.E2E_STARTUP_TIMEOUT_MS || 120000);
const AUTO_START = process.env.E2E_AUTO_START !== 'false';
const COMPOSE_FILE_DIR = process.cwd();
const MANAGED_DOCKER_SERVICES = ['postgres', 'redis', 'minio', 'vibescan'];
const DEMO_USERS = [
  { email: 'arjun.mehta@finstack.io', password: 'vs_demo_pro_2026', region: 'OTHER' },
  { email: 'priya.sharma@devcraft.in', password: 'vs_demo_starter_2026', region: 'IN' },
  { email: 'rafael.torres@securecorp.com', password: 'vs_demo_ent_2026', region: 'OTHER' },
] as const;

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function checkUrl(url: string, label: string): Promise<string | null> {
  let lastError = 'unknown error';

  for (let attempt = 1; attempt <= RETRY_COUNT; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), CHECK_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        method: 'GET',
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (response.ok) {
        return null;
      }

      lastError = `HTTP ${response.status}`;
    } catch (error) {
      clearTimeout(timeout);
      const errorMessage = error instanceof Error ? error.message : String(error);
      lastError = errorMessage;
    }

    if (attempt < RETRY_COUNT) {
      await sleep(RETRY_DELAY_MS);
    }
  }

  return `${label} check failed at ${url} (${lastError})`;
}

async function postJson(url: string, data: Record<string, unknown>) {
  return fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(data),
  });
}

async function ensureDemoUser(user: (typeof DEMO_USERS)[number]): Promise<void> {
  const loginResponse = await postJson(`${API_URL}/auth/login`, {
    email: user.email,
    password: user.password,
  });
  if (loginResponse.ok) {
    return;
  }

  const registerResponse = await postJson(`${API_URL}/auth/register`, user);
  if (!(registerResponse.status === 201 || registerResponse.status === 409)) {
    throw new Error(`Failed to register demo user ${user.email}: HTTP ${registerResponse.status}`);
  }

  const verifyLoginResponse = await postJson(`${API_URL}/auth/login`, {
    email: user.email,
    password: user.password,
  });
  if (!verifyLoginResponse.ok) {
    throw new Error(
      `Demo user ${user.email} is not login-ready with expected credentials (HTTP ${verifyLoginResponse.status})`
    );
  }
}

async function ensureDemoUsers(): Promise<void> {
  for (const user of DEMO_USERS) {
    await ensureDemoUser(user);
  }
}

function isLocalUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return ['localhost', '127.0.0.1'].includes(parsed.hostname);
  } catch {
    return false;
  }
}

function dockerComposeCommand(): string {
  if (process.env.E2E_DOCKER_COMPOSE_CMD) {
    return process.env.E2E_DOCKER_COMPOSE_CMD;
  }
  return 'docker compose';
}

async function runDockerCompose(args: string[]): Promise<void> {
  const [command, ...baseArgs] = dockerComposeCommand().split(' ');
  const child = spawn(command, [...baseArgs, ...args], {
    cwd: COMPOSE_FILE_DIR,
    stdio: 'inherit',
    shell: false,
  });
  const [code] = (await once(child, 'exit')) as [number | null];
  if (code !== 0) {
    throw new Error(`"${dockerComposeCommand()} ${args.join(' ')}" failed with code ${code ?? 'null'}`);
  }
}

async function listRunningComposeServices(): Promise<Set<string>> {
  const [command, ...baseArgs] = dockerComposeCommand().split(' ');
  const child = spawn(command, [...baseArgs, 'ps', '--status', 'running', '--services'], {
    cwd: COMPOSE_FILE_DIR,
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: false,
  });

  let output = '';
  child.stdout?.on('data', (chunk) => {
    output += String(chunk);
  });

  let errorOutput = '';
  child.stderr?.on('data', (chunk) => {
    errorOutput += String(chunk);
  });

  const [code] = (await once(child, 'exit')) as [number | null];
  if (code !== 0) {
    throw new Error(`Unable to inspect docker compose services: ${errorOutput || `exit ${code ?? 'null'}`}`);
  }

  return new Set(
    output
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
  );
}

async function waitForHealthy(url: string, label: string, timeoutMs: number): Promise<void> {
  const start = Date.now();
  let lastError = '';
  while (Date.now() - start < timeoutMs) {
    const failure = await checkUrl(url, label);
    if (!failure) {
      return;
    }
    lastError = failure;
    await sleep(RETRY_DELAY_MS);
  }

  throw new Error(`${label} did not become healthy within ${timeoutMs}ms. Last error: ${lastError}`);
}

async function stopChildProcess(pid: number): Promise<void> {
  try {
    process.kill(pid, 'SIGTERM');
  } catch {
    return;
  }

  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    try {
      process.kill(pid, 0);
      await sleep(200);
    } catch {
      return;
    }
  }

  try {
    process.kill(pid, 'SIGKILL');
  } catch {
    // no-op
  }
}

export default async function globalSetup(_config: FullConfig) {
  const cleanupFns: Array<() => Promise<void>> = [];
  const startupErrors: string[] = [];

  const initialChecks = await Promise.all([
    checkUrl(`${API_URL}/health`, 'API service'),
    checkUrl(`${FRONTEND_URL}/login`, 'Frontend service'),
  ]);

  const [apiFailure, frontendFailure] = initialChecks;

  if (AUTO_START && apiFailure && isLocalUrl(API_URL)) {
    try {
      const running = await listRunningComposeServices();
      const startedBySetup: string[] = [];
      for (const service of MANAGED_DOCKER_SERVICES) {
        if (!running.has(service)) {
          await runDockerCompose(['up', '-d', service]);
          startedBySetup.push(service);
        }
      }

      if (startedBySetup.length > 0) {
        cleanupFns.push(async () => {
          await runDockerCompose(['stop', ...startedBySetup]);
        });
      }

      await waitForHealthy(`${API_URL}/health`, 'API service', STARTUP_TIMEOUT_MS);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      startupErrors.push(`Failed to auto-start API dependencies: ${errorMessage}`);
    }
  }

  if (AUTO_START && frontendFailure && isLocalUrl(FRONTEND_URL)) {
    try {
      const frontendUrl = new URL(FRONTEND_URL);
      const frontendPort = frontendUrl.port || '3000';
      const frontendHost = frontendUrl.hostname;
      const frontendProcess = spawn(
        'node',
        ['./node_modules/next/dist/bin/next', 'dev', '--hostname', frontendHost, '--port', frontendPort],
        {
          cwd: `${process.cwd()}/vibescan-ui`,
          env: {
            ...process.env,
            NEXT_PUBLIC_API_URL: API_URL,
          },
          stdio: 'inherit',
          shell: false,
        }
      );

      cleanupFns.push(async () => {
        if (frontendProcess.pid) {
          await stopChildProcess(frontendProcess.pid);
        }
      });

      await waitForHealthy(`${FRONTEND_URL}/login`, 'Frontend service', STARTUP_TIMEOUT_MS);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      startupErrors.push(`Failed to auto-start frontend: ${errorMessage}`);
    }
  }

  const finalChecks = await Promise.all([
    checkUrl(`${API_URL}/health`, 'API service'),
    checkUrl(`${FRONTEND_URL}/login`, 'Frontend service'),
  ]);
  const errors = [...finalChecks.filter((value): value is string => Boolean(value)), ...startupErrors];
  if (errors.length === 0) {
    await ensureDemoUsers();
    return async () => {
      for (const cleanup of cleanupFns.reverse()) {
        try {
          await cleanup();
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          console.warn(`E2E cleanup warning: ${message}`);
        }
      }
    };
  }

  const startupHint = AUTO_START
    ? 'Auto-start was attempted for local services.'
    : 'Auto-start is disabled. Set E2E_AUTO_START=true to enable it.';

  throw new Error(
    [
      'E2E setup failed: required services are unavailable.',
      ...errors.map((error) => `- ${error}`),
      '',
      startupHint,
      '',
      'Optional overrides:',
      '- API_URL=http://<host>:3001',
      '- FRONTEND_URL=http://<host>:3000',
      '- E2E_AUTO_START=false',
    ].join('\n')
  );
}
