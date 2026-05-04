import {
  runRemoteCommandViaSsh,
  shellQuote,
  type RemoteCommandExecutor,
  type RemoteSshConfig,
} from '../lib/scanners/remoteSsh.js';

type ScannerKind = 'johnny' | 'snyk';

interface ScannerHealthConfig {
  kind: ScannerKind;
  ssh: RemoteSshConfig;
  probeDirectory: string;
  probeCommand: string;
  timeoutMs: number;
}

export interface ScannerHealthSnapshot {
  kind: ScannerKind;
  configured: boolean;
  healthy: boolean | null;
  checkedAt: string | null;
  healthyAt: string | null;
  host: string | null;
  probeDirectory: string | null;
  probeCommand: string | null;
  error: string | null;
}

const HEALTH_INTERVAL_MS = 5 * 60 * 1000;
const HEALTH_TIMEOUT_MS = 45 * 1000;

let healthTimer: ReturnType<typeof setInterval> | null = null;
let healthRunning = false;

const healthState: Record<ScannerKind, ScannerHealthSnapshot> = {
  johnny: {
    kind: 'johnny',
    configured: false,
    healthy: null,
    checkedAt: null,
    healthyAt: null,
    host: null,
    probeDirectory: null,
    probeCommand: null,
    error: null,
  },
  snyk: {
    kind: 'snyk',
    configured: false,
    healthy: null,
    checkedAt: null,
    healthyAt: null,
    host: null,
    probeDirectory: null,
    probeCommand: null,
    error: null,
  },
};

function getIntervalMs(): number {
  const raw = process.env.SCANNER_HEALTH_INTERVAL_MS?.trim();
  const parsed = raw ? Number.parseInt(raw, 10) : HEALTH_INTERVAL_MS;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : HEALTH_INTERVAL_MS;
}

function getTimeoutMs(): number {
  const raw = process.env.SCANNER_HEALTH_TIMEOUT_MS?.trim();
  const parsed = raw ? Number.parseInt(raw, 10) : HEALTH_TIMEOUT_MS;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : HEALTH_TIMEOUT_MS;
}

function buildDefaultProbeCommand(probeDirectory: string, binaryName: string): string {
  const binaryPath = `${probeDirectory.replace(/\/+$/, '')}/${binaryName}`;
  return [
    'set -euo pipefail',
    `ls -la ${shellQuote(probeDirectory)}`,
    `test -x ${shellQuote(binaryPath)}`,
    `timeout 10s ${shellQuote(binaryPath)}`,
  ].join('; ');
}

function readSshConfig(prefix: 'CODESCORING' | 'SNYK'): RemoteSshConfig | null {
  const host = process.env[`${prefix}_SSH_HOST`]?.trim();
  if (!host) {
    return null;
  }

  const portRaw = process.env[`${prefix}_SSH_PORT`]?.trim();
  const port = portRaw ? Number.parseInt(portRaw, 10) : 22;

  return {
    host,
    user: process.env[`${prefix}_SSH_USER`]?.trim() || undefined,
    port: Number.isFinite(port) ? port : 22,
    identityFile: process.env[`${prefix}_SSH_IDENTITY_FILE`]?.trim() || undefined,
  };
}

function readScannerHealthConfig(kind: ScannerKind): ScannerHealthConfig | null {
  if (kind === 'johnny') {
    const ssh = readSshConfig('CODESCORING');
    if (!ssh) {
      return null;
    }

    const probeDirectory = process.env.CODESCORING_JOHNNY_HEALTH_DIR?.trim()
      || process.env.CODESCORING_SSH_REMOTE_TMP_DIR?.trim()
      || '/tmp';

    return {
      kind,
      ssh,
      probeDirectory,
      probeCommand:
        process.env.CODESCORING_JOHNNY_HEALTH_COMMAND?.trim()
        || buildDefaultProbeCommand(probeDirectory, 'johnny'),
      timeoutMs: getTimeoutMs(),
    };
  }

  const ssh = readSshConfig('SNYK');
  if (!ssh) {
    return null;
  }

  const probeDirectory = process.env.SNYK_HEALTH_DIR?.trim() || '/opt/snyk';

  return {
    kind,
    ssh,
    probeDirectory,
    probeCommand:
      process.env.SNYK_HEALTH_COMMAND?.trim()
      || buildDefaultProbeCommand(probeDirectory, 'snyk'),
    timeoutMs: getTimeoutMs(),
  };
}

function getSnapshot(kind: ScannerKind): ScannerHealthSnapshot {
  return { ...healthState[kind] };
}

function updateSnapshot(kind: ScannerKind, patch: Partial<ScannerHealthSnapshot>): void {
  healthState[kind] = {
    ...healthState[kind],
    ...patch,
  };
}

async function runScannerHealthCheck(
  kind: ScannerKind,
  executor?: RemoteCommandExecutor,
): Promise<void> {
  const config = readScannerHealthConfig(kind);
  const checkedAt = new Date().toISOString();

  if (!config) {
    updateSnapshot(kind, {
      configured: false,
      healthy: null,
      checkedAt,
      healthyAt: null,
      host: null,
      probeDirectory: null,
      probeCommand: null,
      error: null,
    });
    return;
  }

  const result = runRemoteCommandViaSsh(
    config.ssh,
    config.probeCommand,
    '',
    config.timeoutMs,
    executor,
  );
  const healthy = result.status === 0 && !result.error;

  updateSnapshot(kind, {
    configured: true,
    healthy,
    checkedAt,
    healthyAt: healthy ? checkedAt : healthState[kind].healthyAt,
    host: config.ssh.host,
    probeDirectory: config.probeDirectory,
    probeCommand: config.probeCommand,
    error: healthy
      ? null
      : (result.error?.message || result.stderr || `Probe exited with ${result.status ?? 'unknown'}`),
  });
}

export function getScannerHealthSnapshot(): Record<ScannerKind, ScannerHealthSnapshot> {
  return {
    johnny: getSnapshot('johnny'),
    snyk: getSnapshot('snyk'),
  };
}

export async function refreshScannerHealth(
  executor?: RemoteCommandExecutor,
): Promise<Record<ScannerKind, ScannerHealthSnapshot>> {
  if (healthRunning) {
    return getScannerHealthSnapshot();
  }

  healthRunning = true;
  try {
    await Promise.all([
      runScannerHealthCheck('johnny', executor),
      runScannerHealthCheck('snyk', executor),
    ]);
    return getScannerHealthSnapshot();
  } finally {
    healthRunning = false;
  }
}

export function startScannerHealthMonitor(): void {
  if (healthTimer) {
    return;
  }

  healthTimer = setInterval(() => {
    void refreshScannerHealth().catch((error) => {
      console.error('[ScannerHealth] Refresh failed:', error);
    });
  }, getIntervalMs());

  healthTimer.unref?.();
  void refreshScannerHealth().catch((error) => {
    console.error('[ScannerHealth] Initial refresh failed:', error);
  });
}

export function stopScannerHealthMonitor(): void {
  if (!healthTimer) {
    return;
  }

  clearInterval(healthTimer);
  healthTimer = null;
}
