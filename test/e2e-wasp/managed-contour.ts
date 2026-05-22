import { execSync, spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

type ManagedContourState = {
  startedByE2E: boolean;
  pid: number;
  command: string;
  startedAt: string;
  databaseUrl?: string;
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "../..");
const startScript = path.join(repoRoot, "scripts", "wasp-dev.sh");
const stateFile = path.join(repoRoot, ".logs", "e2e-managed-contour.json");

function getBackendBaseUrl(): string {
  return (
    process.env.API_URL ||
    process.env.WASP_SERVER_URL ||
    "http://127.0.0.1:3555"
  ).replace(/\/$/, "");
}

function getFrontendBaseUrl(): string {
  return (
    process.env.FRONTEND_URL ||
    process.env.WASP_WEB_CLIENT_URL ||
    "http://127.0.0.1:3000"
  ).replace(/\/$/, "");
}

function isAutoStartEnabled(): boolean {
  const value = process.env.E2E_AUTO_START;
  if (value === undefined) {
    return true;
  }

  return !["false", "0", "no", "off"].includes(value.trim().toLowerCase());
}

function isLocalHost(urlString: string): boolean {
  try {
    const url = new URL(urlString);
    return ["127.0.0.1", "localhost", "::1"].includes(url.hostname);
  } catch {
    return false;
  }
}

async function fetchWithTimeout(url: string, timeoutMs = 2000): Promise<boolean> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: "GET",
      signal: controller.signal,
    });
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

export async function isBackendReady(): Promise<boolean> {
  const backendBaseUrl = getBackendBaseUrl();
  return (
    (await fetchWithTimeout(`${backendBaseUrl}/`)) ||
    (await fetchWithTimeout(`${backendBaseUrl}/health`))
  );
}

export async function isFrontendReady(): Promise<boolean> {
  return fetchWithTimeout(`${getFrontendBaseUrl()}/login`);
}

async function readManagedContourState(): Promise<ManagedContourState | null> {
  try {
    const raw = await fs.readFile(stateFile, "utf8");
    return JSON.parse(raw) as ManagedContourState;
  } catch {
    return null;
  }
}

async function writeManagedContourState(state: ManagedContourState): Promise<void> {
  await fs.mkdir(path.dirname(stateFile), { recursive: true });
  await fs.writeFile(stateFile, `${JSON.stringify(state, null, 2)}\n`, "utf8");
}

async function removeManagedContourState(): Promise<void> {
  await fs.rm(stateFile, { force: true });
}

function detectManagedDatabaseUrl(): string {
  const hostPort = execSync(
    "docker inspect --format '{{with (index .NetworkSettings.Ports \"5432/tcp\")}}{{(index . 0).HostPort}}{{end}}' vibescan-postgres",
    { cwd: repoRoot, encoding: "utf8" }
  ).trim();

  if (!hostPort) {
    throw new Error("Unable to detect managed PostgreSQL host port");
  }

  return `postgresql://vibescan:vibescan@127.0.0.1:${hostPort}/vibescan`;
}

export async function getManagedContourDatabaseUrl(): Promise<string> {
  const state = await readManagedContourState();
  if (state?.databaseUrl) {
    return state.databaseUrl;
  }

  return detectManagedDatabaseUrl();
}

export async function ensureManagedContourStarted(): Promise<boolean> {
  const existingState = await readManagedContourState();
  if (existingState) {
    const ready = (await isBackendReady()) && (await isFrontendReady());
    if (ready) {
      return false;
    }

    await removeManagedContourState();
  }

  if (!isAutoStartEnabled()) {
    return false;
  }

  if (!isLocalHost(getBackendBaseUrl()) || !isLocalHost(getFrontendBaseUrl())) {
    console.warn(
      `[E2E] Auto-start skipped because configured endpoints are not local: backend=${getBackendBaseUrl()} frontend=${getFrontendBaseUrl()}`
    );
    return false;
  }

  console.log("[E2E] Auto-starting managed Wasp contour via ./scripts/wasp-dev.sh up");
  const child = spawn("bash", [startScript, "up"], {
    cwd: repoRoot,
    detached: true,
    stdio: "ignore",
    env: process.env,
  });

  if (!child.pid) {
    throw new Error("Failed to spawn managed Wasp contour for e2e");
  }

  child.unref();

  await writeManagedContourState({
    startedByE2E: true,
    pid: child.pid,
    command: "./scripts/wasp-dev.sh up",
    startedAt: new Date().toISOString(),
  });

  return true;
}

export async function waitForManagedContourReady(
  maxWaitMs = 240_000,
  pollIntervalMs = 2_000
): Promise<void> {
  const deadline = Date.now() + maxWaitMs;

  while (Date.now() < deadline) {
    const [backendReady, frontendReady] = await Promise.all([
      isBackendReady(),
      isFrontendReady(),
    ]);

    if (backendReady && frontendReady) {
      const state = await readManagedContourState();
      if (state && !state.databaseUrl) {
        await writeManagedContourState({
          ...state,
          databaseUrl: detectManagedDatabaseUrl(),
        });
      }
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }

  throw new Error(
    `Managed Wasp contour did not become ready within ${maxWaitMs}ms (${getBackendBaseUrl()} / ${getFrontendBaseUrl()})`
  );
}

export async function stopManagedContourIfStarted(): Promise<void> {
  const state = await readManagedContourState();
  if (!state?.startedByE2E) {
    return;
  }

  try {
    await new Promise<void>((resolve, reject) => {
      const child = spawn("bash", [startScript, "down"], {
        cwd: repoRoot,
        stdio: "inherit",
        env: process.env,
      });

      child.on("error", reject);
      child.on("exit", (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Managed contour stop exited with code ${code ?? "unknown"}`));
        }
      });
    });
  } finally {
    await removeManagedContourState();
  }
}
