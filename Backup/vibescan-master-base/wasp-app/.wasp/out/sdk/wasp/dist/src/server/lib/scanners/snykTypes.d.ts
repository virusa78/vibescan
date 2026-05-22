import type { NormalizedFinding } from '../../operations/scans/normalizeFindings.js';
import type { RemoteCommandExecutor, RemoteCommandResult, RemoteSshConfig } from './remoteSsh.js';
export type SnykRuntimeMode = 'auto' | 'local' | 'ssh' | 'mock';
export type SnykCredentialMode = 'auto' | 'environment' | 'user-secret';
export interface SnykCredentials {
    token: string;
    orgId?: string;
}
export interface SnykRuntimeConfig {
    mode: SnykRuntimeMode;
    commandTemplate: string;
    timeoutMs: number;
    ssh: RemoteSshConfig | null;
    remoteTempDir: string;
}
export interface SnykSshRuntimeConfig extends RemoteSshConfig {
    commandTemplate: string;
    remoteTempDir: string;
    timeoutMs: number;
}
export interface SnykCliVulnerability {
    id?: string;
    title?: string;
    severity?: string;
    packageName?: string;
    name?: string;
    version?: string;
    fixedIn?: string[];
    nearestFixedInVersion?: string;
    upgradePath?: string[];
    identifiers?: {
        CVE?: string[];
    };
    description?: string;
    cvssScore?: number;
    cvssScoreV3?: number;
}
export interface SnykRawOutput {
    ok?: boolean;
    vulnerabilities?: SnykCliVulnerability[];
}
export interface SnykScanRun {
    rawOutput: SnykRawOutput;
    findings: NormalizedFinding[];
    durationMs: number;
    scannerVersion: string;
}
export type SnykRuntimeExecutor = (command: string, args: string[], input: string, timeoutMs: number, env?: NodeJS.ProcessEnv) => RemoteCommandResult;
export type SnykSshExecutor = RemoteCommandExecutor;
//# sourceMappingURL=snykTypes.d.ts.map