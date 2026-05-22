import { type RemoteCommandExecutor, type RemoteSshConfig } from './remoteSsh.js';
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
export declare function buildJohnnySshArgs(config: JohnnyRuntimeConfig, remoteShellCommand: string): string[];
export declare function isJohnnyRemoteConfigured(): boolean;
export declare function runJohnnyScanViaSsh(components: JohnnyComponent[], scanId: string, timeoutMs: number, executor?: JohnnyExecutor): string;
export {};
//# sourceMappingURL=codescoringJohnnyRuntime.d.ts.map