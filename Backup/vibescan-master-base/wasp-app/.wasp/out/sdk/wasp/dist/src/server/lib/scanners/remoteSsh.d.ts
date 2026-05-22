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
export type RemoteCommandExecutor = (command: string, args: string[], input: string, timeoutMs: number) => RemoteCommandResult;
export declare function shellQuote(value: string): string;
export declare function buildSshArgs(config: RemoteSshConfig, remoteCommand: string): string[];
export declare function runRemoteCommandViaSsh(config: RemoteSshConfig, remoteCommand: string, input: string, timeoutMs: number, executor?: RemoteCommandExecutor): RemoteCommandResult;
//# sourceMappingURL=remoteSsh.d.ts.map