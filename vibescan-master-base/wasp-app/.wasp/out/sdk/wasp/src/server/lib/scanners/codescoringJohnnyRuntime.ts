import { spawnSync } from 'child_process';
import { shellQuote, type RemoteCommandResult, type RemoteCommandExecutor, type RemoteSshConfig } from './remoteSsh.js';

export interface JohnnyComponent {
  name: string;
  version: string;
  purl?: string;
  type?: string;
}

interface JohnnyRuntimeConfig extends RemoteSshConfig {
  commandTemplate: string;
  remoteTempDir: string;
}

type JohnnyExecutor = RemoteCommandExecutor;

function buildCycloneDxSbom(components: JohnnyComponent[]) {
  return {
    bomFormat: 'CycloneDX',
    specVersion: '1.6',
    version: 1,
    components: components.map((component) => ({
      type: component.type || 'library',
      name: component.name,
      version: component.version,
      purl: component.purl,
    })),
  };
}

function defaultExecutor(
  command: string,
  args: string[],
  input: string,
  timeoutMs: number,
): RemoteCommandResult {
  const result = spawnSync(command, args, {
    input,
    encoding: 'utf8',
    timeout: timeoutMs,
    maxBuffer: 20 * 1024 * 1024,
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  return {
    status: result.status,
    stdout: typeof result.stdout === 'string' ? result.stdout : '',
    stderr: typeof result.stderr === 'string' ? result.stderr : '',
    error: result.error instanceof Error ? result.error : null,
  };
}

function getJohnnyRuntimeConfig(): JohnnyRuntimeConfig | null {
  const host = process.env.CODESCORING_SSH_HOST?.trim();
  if (!host) {
    return null;
  }

  const portRaw = process.env.CODESCORING_SSH_PORT?.trim();
  const port = portRaw ? Number.parseInt(portRaw, 10) : 22;

  return {
    host,
    user: process.env.CODESCORING_SSH_USER?.trim() || undefined,
    port: Number.isFinite(port) ? port : 22,
    identityFile: process.env.CODESCORING_SSH_IDENTITY_FILE?.trim() || undefined,
    commandTemplate:
      process.env.CODESCORING_JOHNNY_COMMAND?.trim()
      || 'johnny scan --format json --no-summary --bom-path "$VIBESCAN_BOM_PATH"',
    remoteTempDir: process.env.CODESCORING_SSH_REMOTE_TMP_DIR?.trim() || '/tmp',
  };
}

function buildRemoteShellCommand(commandTemplate: string, remoteBomPath: string): string {
  const command = commandTemplate.trim()
    || 'johnny scan --format json --no-summary --bom-path "$VIBESCAN_BOM_PATH"';

  return [
    'set -euo pipefail',
    `export VIBESCAN_BOM_PATH=${shellQuote(remoteBomPath)}`,
    `trap 'rm -f "$VIBESCAN_BOM_PATH"' EXIT`,
    'cat > "$VIBESCAN_BOM_PATH"',
    command,
  ].join('; ');
}

function buildRawSshArgs(config: JohnnyRuntimeConfig, remoteShellCommand: string): string[] {
  const target = config.user ? `${config.user}@${config.host}` : config.host;
  const args = [
    '-T',
    '-o',
    'BatchMode=yes',
    '-o',
    'StrictHostKeyChecking=accept-new',
    '-o',
    'ServerAliveInterval=15',
    '-o',
    'ServerAliveCountMax=2',
    '-p',
    String(config.port),
  ];

  if (config.identityFile) {
    args.push('-i', config.identityFile);
  }

  args.push(target, remoteShellCommand);
  return args;
}

function normalizeSuccessfulOutput(stdout: string, status: number | null): string {
  const trimmed = stdout.trim();
  if (trimmed.length > 0) {
    return stdout;
  }

  if (status === 3 || status === 0 || status === 1) {
    return JSON.stringify({ vulnerabilities: [] });
  }

  return stdout;
}

function resolveJohnnyResult(result: RemoteCommandResult): string {
  if (result.error && result.status === null) {
    throw result.error;
  }

  switch (result.status) {
    case 0:
    case 1:
    case 3:
      if (result.status === 1 && result.stdout.trim().length === 0) {
        console.warn('[CodeScoring] Johnny exited with issues but produced no JSON output; returning empty findings');
      }
      return normalizeSuccessfulOutput(result.stdout, result.status);
    case 2:
      throw new Error(`CodeScoring Johnny scan failed: ${result.stderr || 'remote run failure'}`);
    case 4:
      throw new Error(`CodeScoring Johnny signing or verification failed: ${result.stderr || 'signature failure'}`);
    case 5:
      throw new Error(`CodeScoring Johnny BOM validation failed: ${result.stderr || 'validation error'}`);
    default:
      throw new Error(`CodeScoring Johnny returned unexpected exit code ${result.status ?? 'unknown'}: ${result.stderr || 'no stderr output'}`);
  }
}

export function buildJohnnySshArgs(config: JohnnyRuntimeConfig, remoteShellCommand: string): string[] {
  return buildRawSshArgs(config, remoteShellCommand);
}

export function isJohnnyRemoteConfigured(): boolean {
  return getJohnnyRuntimeConfig() !== null;
}

export function runJohnnyScanViaSsh(
  components: JohnnyComponent[],
  scanId: string,
  timeoutMs: number,
  executor: JohnnyExecutor = defaultExecutor,
): string {
  const config = getJohnnyRuntimeConfig();
  if (!config) {
    throw new Error('CodeScoring Johnny SSH runtime is not configured');
  }

  const bomJson = JSON.stringify(buildCycloneDxSbom(components), null, 2);
  const remoteBomPath = `${config.remoteTempDir.replace(/\/+$/, '')}/vibescan-${scanId}-${Date.now()}.json`;
  const remoteShellCommand = buildRemoteShellCommand(config.commandTemplate, remoteBomPath);
  const sshArgs = buildRawSshArgs(config, remoteShellCommand);
  const result = executor('ssh', sshArgs, bomJson, timeoutMs);

  return resolveJohnnyResult(result);
}
