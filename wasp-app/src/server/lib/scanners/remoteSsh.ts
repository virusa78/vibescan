import { spawnSync } from 'child_process';

export interface RemoteSshConfig {
  host: string;
  user?: string;
  port: number;
  identityFile?: string;
}

export interface RemoteCommandResult {
  status: number | null;
  stdout: string;
  stderr: string;
  error: Error | null;
}

export type RemoteCommandExecutor = (
  command: string,
  args: string[],
  input: string,
  timeoutMs: number,
) => RemoteCommandResult;

export function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\"'\"'`)}'`;
}

export function buildSshArgs(config: RemoteSshConfig, remoteCommand: string): string[] {
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

  args.push(target, remoteCommand);
  return args;
}

export function runRemoteCommandViaSsh(
  config: RemoteSshConfig,
  remoteCommand: string,
  input: string,
  timeoutMs: number,
  executor: RemoteCommandExecutor = defaultExecutor,
): RemoteCommandResult {
  const sshArgs = buildSshArgs(config, remoteCommand);
  return executor('ssh', sshArgs, input, timeoutMs);
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
