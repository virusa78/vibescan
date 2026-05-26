import { spawn } from 'child_process';

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
) => Promise<RemoteCommandResult>;

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

export async function runRemoteCommandViaSsh(
  config: RemoteSshConfig,
  remoteCommand: string,
  input: string,
  timeoutMs: number,
  executor: RemoteCommandExecutor = defaultExecutor,
): Promise<RemoteCommandResult> {
  const sshArgs = buildSshArgs(config, remoteCommand);
  return await executor('ssh', sshArgs, input, timeoutMs);
}

function defaultExecutor(
  command: string,
  args: string[],
  input: string,
  timeoutMs: number,
): Promise<RemoteCommandResult> {
  return new Promise((resolve) => {
    try {
      const child = spawn(command, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';
      let error: Error | null = null;
      let killedDueToTimeout = false;

      const timeout = setTimeout(() => {
        killedDueToTimeout = true;
        child.kill('SIGTERM');
        error = new Error(`Command execution timed out after ${timeoutMs}ms`);
      }, timeoutMs);

      if (child.stdin) {
        child.stdin.on('error', (err) => {
          // Ignore EPIPE errors which happen if the command exits before we finish writing
          if ((err as any).code !== 'EPIPE') {
            error = err;
          }
        });
        child.stdin.write(input);
        child.stdin.end();
      }

      if (child.stdout) {
        child.stdout.setEncoding('utf8');
        child.stdout.on('data', (data) => {
          stdout += data;
        });
      }

      if (child.stderr) {
        child.stderr.setEncoding('utf8');
        child.stderr.on('data', (data) => {
          stderr += data;
        });
      }

      child.on('error', (err) => {
        error = err;
      });

      child.on('close', (status) => {
        clearTimeout(timeout);
        resolve({
          status: killedDueToTimeout ? null : status,
          stdout,
          stderr,
          error: error || (killedDueToTimeout ? new Error('Timeout') : null),
        });
      });
    } catch (err) {
      resolve({
        status: null,
        stdout: '',
        stderr: '',
        error: err instanceof Error ? err : new Error(String(err)),
      });
    }
  });
}
