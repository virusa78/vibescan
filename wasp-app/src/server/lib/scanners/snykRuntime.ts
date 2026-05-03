import { spawnSync } from 'child_process';
import { buildCycloneDxSbom, type NormalizedComponent } from '../../services/inputAdapterService.js';
import type { NormalizedFinding } from '../../operations/scans/normalizeFindings.js';
import { shellQuote, type RemoteCommandResult, runRemoteCommandViaSsh } from './remoteSsh.js';
import {
  getSnykCredentialMode,
  getSnykTimeoutMs,
} from '../../config/runtime.js';
import type {
  SnykCredentials,
  SnykRawOutput,
  SnykRuntimeConfig,
  SnykRuntimeExecutor,
  SnykRuntimeMode,
  SnykScanRun,
  SnykSshExecutor,
  SnykSshRuntimeConfig,
} from './snykTypes.js';
import type { ScannerResolvedCredentials } from './providerTypes.js';

function defaultLocalExecutor(
  command: string,
  args: string[],
  input: string,
  timeoutMs: number,
  env: NodeJS.ProcessEnv = process.env,
): RemoteCommandResult {
  const result = spawnSync(command, args, {
    input,
    encoding: 'utf8',
    timeout: timeoutMs,
    maxBuffer: 20 * 1024 * 1024,
    stdio: ['pipe', 'pipe', 'pipe'],
    env,
  });

  return {
    status: result.status,
    stdout: typeof result.stdout === 'string' ? result.stdout : '',
    stderr: typeof result.stderr === 'string' ? result.stderr : '',
    error: result.error instanceof Error ? result.error : null,
  };
}

function getRuntimeMode(): SnykRuntimeMode {
  const raw = process.env.SNYK_RUNTIME?.trim().toLowerCase();
  if (raw === 'local' || raw === 'ssh' || raw === 'mock') {
    return raw;
  }

  return 'auto';
}

function getSnykRuntimeConfig(): SnykRuntimeConfig {
  const portRaw = process.env.SNYK_SSH_PORT?.trim();
  const port = portRaw ? Number.parseInt(portRaw, 10) : 22;
  const sshHost = process.env.SNYK_SSH_HOST?.trim();

  return {
    mode: getRuntimeMode(),
    commandTemplate:
      process.env.SNYK_COMMAND?.trim()
      || 'snyk sbom test --file="$VIBESCAN_BOM_PATH" --json',
    timeoutMs: getSnykTimeoutMs(),
    ssh: sshHost
      ? {
          host: sshHost,
          user: process.env.SNYK_SSH_USER?.trim() || undefined,
          port: Number.isFinite(port) ? port : 22,
          identityFile: process.env.SNYK_SSH_IDENTITY_FILE?.trim() || undefined,
        }
      : null,
    remoteTempDir: process.env.SNYK_SSH_REMOTE_TMP_DIR?.trim() || '/tmp',
  };
}

function buildCredentialsFromResolved(resolvedCredentials?: ScannerResolvedCredentials): SnykCredentials | null {
  const token = resolvedCredentials?.values.token?.trim();
  if (!token) {
    return null;
  }

  return {
    token,
    orgId: resolvedCredentials!.values.orgId,
  };
}

function buildNormalizedFindings(rawOutput: SnykRawOutput): NormalizedFinding[] {
  return (rawOutput.vulnerabilities || []).map((vulnerability) => {
    const cveId = vulnerability.identifiers?.CVE?.[0]
      || vulnerability.id
      || vulnerability.title
      || 'UNKNOWN';
    const fixedVersion = vulnerability.fixedIn?.[0]
      || vulnerability.nearestFixedInVersion
      || vulnerability.upgradePath?.find((item) => !!item && item !== 'false')
      || undefined;
    const severity = (vulnerability.severity || 'info').toLowerCase() as NormalizedFinding['severity'];
    const packageName = vulnerability.packageName || vulnerability.name || 'unknown';
    const version = vulnerability.version || 'unknown';

    return {
      cveId,
      severity,
      package: packageName,
      version,
      fixedVersion,
      description: vulnerability.description || vulnerability.title || 'Snyk reported vulnerability',
      cvssScore: vulnerability.cvssScoreV3 || vulnerability.cvssScore || 0,
      source: 'snyk',
    };
  });
}

function parseSnykJson(stdout: string): SnykRawOutput {
  const trimmed = stdout.trim();
  if (!trimmed) {
    return { ok: true, vulnerabilities: [] };
  }

  const parsed = JSON.parse(trimmed) as SnykRawOutput;
  return {
    ok: parsed.ok,
    vulnerabilities: Array.isArray(parsed.vulnerabilities) ? parsed.vulnerabilities : [],
  };
}

function resolveSnykResult(result: RemoteCommandResult): SnykRawOutput {
  if (result.error && result.status === null) {
    throw result.error;
  }

  switch (result.status) {
    case 0:
    case 1:
      return parseSnykJson(result.stdout);
    case 2:
      throw new Error(`Snyk credentials or authentication failed: ${result.stderr || 'authentication failure'}`);
    default:
      throw new Error(`Snyk scan failed with exit code ${result.status ?? 'unknown'}: ${result.stderr || 'no stderr output'}`);
  }
}

function buildEnvForCredentials(credentials: SnykCredentials): NodeJS.ProcessEnv {
  return {
    ...process.env,
    SNYK_TOKEN: credentials.token,
    ...(credentials.orgId ? { SNYK_ORG_ID: credentials.orgId } : {}),
  };
}

function buildSshShellCommand(commandTemplate: string, remoteBomPath: string, credentials: SnykCredentials): string {
  const exports = [
    `export VIBESCAN_BOM_PATH=${shellQuote(remoteBomPath)}`,
    `export SNYK_TOKEN=${shellQuote(credentials.token)}`,
  ];

  if (credentials.orgId) {
    exports.push(`export SNYK_ORG_ID=${shellQuote(credentials.orgId)}`);
  }

  return [
    'set -euo pipefail',
    ...exports,
    `trap 'rm -f "$VIBESCAN_BOM_PATH"' EXIT`,
    'cat > "$VIBESCAN_BOM_PATH"',
    commandTemplate,
  ].join('; ');
}

function runSnykLocally(
  bomJson: string,
  credentials: SnykCredentials,
  config: SnykRuntimeConfig,
  executor: SnykRuntimeExecutor,
): SnykRawOutput {
  const bomPath = `/tmp/vibescan-sbom-${Date.now()}.json`;
  const result = executor(
    'sh',
    [
      '-lc',
      `set -euo pipefail; trap 'rm -f "$VIBESCAN_BOM_PATH"' EXIT; cat > "$VIBESCAN_BOM_PATH"; ${config.commandTemplate}`,
      'sh',
    ],
    bomJson,
    config.timeoutMs,
    {
      ...buildEnvForCredentials(credentials),
      VIBESCAN_BOM_PATH: bomPath,
    },
  );

  return resolveSnykResult(result);
}

function runSnykViaSsh(
  bomJson: string,
  credentials: SnykCredentials,
  config: SnykSshRuntimeConfig,
  scanId: string,
  executor: SnykSshExecutor,
): SnykRawOutput {
  const remoteBomPath = `${config.remoteTempDir.replace(/\/+$/, '')}/vibescan-snyk-${scanId}-${Date.now()}.json`;
  const command = buildSshShellCommand(config.commandTemplate, remoteBomPath, credentials);
  const result = runRemoteCommandViaSsh(config, command, bomJson, config.timeoutMs, executor);
  return resolveSnykResult(result);
}

export async function runSnykScan(
  components: NormalizedComponent[],
  scanId: string,
  resolvedCredentials: ScannerResolvedCredentials | undefined,
  localExecutor: SnykRuntimeExecutor = defaultLocalExecutor,
  sshExecutor?: SnykSshExecutor,
): Promise<SnykScanRun> {
  const config = getSnykRuntimeConfig();
  const credentials = buildCredentialsFromResolved(resolvedCredentials);
  if (!credentials) {
    throw new Error('Snyk credentials are not configured');
  }

  const credentialMode = getSnykCredentialMode();
  if (credentialMode === 'environment' && resolvedCredentials?.source === 'user-secret') {
    throw new Error('Snyk is configured to use environment credentials only');
  }

  if (credentialMode === 'user-secret' && resolvedCredentials?.source !== 'user-secret') {
    throw new Error('Snyk requires a user-provided API key');
  }

  const startTime = Date.now();
  const bomJson = JSON.stringify(buildCycloneDxSbom(components), null, 2);
  let rawOutput: SnykRawOutput;

  if (config.mode === 'mock') {
    rawOutput = { ok: true, vulnerabilities: [] };
  } else if (config.mode === 'ssh') {
    if (!config.ssh) {
      throw new Error('Snyk SSH runtime is not configured');
    }
    if (!sshExecutor) {
      throw new Error('Snyk SSH executor is not configured');
    }
    rawOutput = runSnykViaSsh(
      bomJson,
      credentials,
      { ...config.ssh, commandTemplate: config.commandTemplate, remoteTempDir: config.remoteTempDir, timeoutMs: config.timeoutMs },
      scanId,
      sshExecutor,
    );
  } else if (config.mode === 'local' || !config.ssh) {
    rawOutput = runSnykLocally(bomJson, credentials, config, localExecutor);
  } else {
    try {
      rawOutput = runSnykLocally(bomJson, credentials, config, localExecutor);
    } catch {
      if (!sshExecutor) {
        throw new Error('Snyk SSH executor is not configured for fallback');
      }
      rawOutput = runSnykViaSsh(
        bomJson,
        credentials,
        { ...config.ssh, commandTemplate: config.commandTemplate, remoteTempDir: config.remoteTempDir, timeoutMs: config.timeoutMs },
        scanId,
        sshExecutor,
      );
    }
  }

  return {
    rawOutput,
    findings: buildNormalizedFindings(rawOutput),
    durationMs: Date.now() - startTime,
    scannerVersion: 'snyk-cli',
  };
}
