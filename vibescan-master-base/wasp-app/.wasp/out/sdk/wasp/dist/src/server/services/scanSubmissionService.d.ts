import type { Scan } from "wasp/entities";
import type { PersistedGitHubScanContext } from './githubAppService';
export type ScanInputType = "github" | "sbom" | "source_zip";
export interface ScanSubmissionResult {
    scan: Scan;
    quotaRemaining: number;
}
interface SubmissionInput {
    userId: string;
    workspaceId: string;
    inputType: ScanInputType;
    inputRef: string;
    githubContext?: PersistedGitHubScanContext | null;
}
export declare function submitScanSubmission(input: SubmissionInput): Promise<ScanSubmissionResult>;
export {};
//# sourceMappingURL=scanSubmissionService.d.ts.map