import { type ScanSubmissionResult } from "./scanSubmissionService.js";
import type { PersistedGitHubScanContext } from './githubAppService';
export type GitHubScanSubmissionResult = ScanSubmissionResult;
export declare function submitGitHubScan(userId: string, workspaceId: string, inputRef: string, githubContext?: PersistedGitHubScanContext | null): Promise<GitHubScanSubmissionResult>;
//# sourceMappingURL=githubScanService.d.ts.map