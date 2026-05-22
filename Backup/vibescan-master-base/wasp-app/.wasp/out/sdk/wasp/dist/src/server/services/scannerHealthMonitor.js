import { runRemoteCommandViaSsh, shellQuote, } from '../lib/scanners/remoteSsh.js';
const HEALTH_INTERVAL_MS = 5 * 60 * 1000;
const HEALTH_TIMEOUT_MS = 45 * 1000;
let healthTimer = null;
let healthRunning = false;
const healthState = {
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
function getIntervalMs() {
    const raw = process.env.SCANNER_HEALTH_INTERVAL_MS?.trim();
    const parsed = raw ? Number.parseInt(raw, 10) : HEALTH_INTERVAL_MS;
    return Number.isFinite(parsed) && parsed > 0 ? parsed : HEALTH_INTERVAL_MS;
}
function getTimeoutMs() {
    const raw = process.env.SCANNER_HEALTH_TIMEOUT_MS?.trim();
    const parsed = raw ? Number.parseInt(raw, 10) : HEALTH_TIMEOUT_MS;
    return Number.isFinite(parsed) && parsed > 0 ? parsed : HEALTH_TIMEOUT_MS;
}
function buildDefaultProbeCommand(probeDirectory, binaryName) {
    const binaryPath = `${probeDirectory.replace(/\/+$/, '')}/${binaryName}`;
    return [
        'set -euo pipefail',
        `ls -la ${shellQuote(probeDirectory)}`,
        `test -x ${shellQuote(binaryPath)}`,
        `timeout 10s ${shellQuote(binaryPath)}`,
    ].join('; ');
}
function readSshConfig(prefix) {
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
function readScannerHealthConfig(kind) {
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
            probeCommand: process.env.CODESCORING_JOHNNY_HEALTH_COMMAND?.trim()
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
        probeCommand: process.env.SNYK_HEALTH_COMMAND?.trim()
            || buildDefaultProbeCommand(probeDirectory, 'snyk'),
        timeoutMs: getTimeoutMs(),
    };
}
function getSnapshot(kind) {
    return { ...healthState[kind] };
}
function updateSnapshot(kind, patch) {
    healthState[kind] = {
        ...healthState[kind],
        ...patch,
    };
}
async function runScannerHealthCheck(kind, executor) {
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
    const result = runRemoteCommandViaSsh(config.ssh, config.probeCommand, '', config.timeoutMs, executor);
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
export function getScannerHealthSnapshot() {
    return {
        johnny: getSnapshot('johnny'),
        snyk: getSnapshot('snyk'),
    };
}
export async function refreshScannerHealth(executor) {
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
    }
    finally {
        healthRunning = false;
    }
}
export function startScannerHealthMonitor() {
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
export function stopScannerHealthMonitor() {
    if (!healthTimer) {
        return;
    }
    clearInterval(healthTimer);
    healthTimer = null;
}
//# sourceMappingURL=scannerHealthMonitor.js.map