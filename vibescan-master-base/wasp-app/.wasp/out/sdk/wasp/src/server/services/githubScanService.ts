import { submitScanSubmission, type ScanSubmissionResult } from "./scanSubmissionService.js";
import type { PersistedGitHubScanContext } from './githubAppService';

export type GitHubScanSubmissionResult = ScanSubmissionResult;

export async function submitGitHubScan(
  userId: string,
  workspaceId: string,
  inputRef: string,
  githubContext?: PersistedGitHubScanContext | null,
): Promise<GitHubScanSubmissionResult> {
  return submitScanSubmission({
    userId,
    workspaceId,
    inputType: "github",
    inputRef,
    githubContext,
  });
}
