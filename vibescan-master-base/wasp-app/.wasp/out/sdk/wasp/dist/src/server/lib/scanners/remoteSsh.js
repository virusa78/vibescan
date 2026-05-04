import { spawnSync } from 'child_process';
export function shellQuote(value) {
    return `'${value.replace(/'/g, `'\"'\"'`)}'`;
}
export function buildSshArgs(config, remoteCommand) {
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
export function runRemoteCommandViaSsh(config, remoteCommand, input, timeoutMs, executor = defaultExecutor) {
    const sshArgs = buildSshArgs(config, remoteCommand);
    return executor('ssh', sshArgs, input, timeoutMs);
}
function defaultExecutor(command, args, input, timeoutMs) {
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
//# sourceMappingURL=remoteSsh.js.map