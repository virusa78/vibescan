import { submitScanSubmission, type ScanSubmissionResult } from "./scanSubmissionService.js";

export type GitHubScanSubmissionResult = ScanSubmissionResult;

export async function submitGitHubScan(
  userId: string,
  inputRef: string,
): Promise<GitHubScanSubmissionResult> {
  return submitScanSubmission({
    userId,
    inputType: "github",
    inputRef,
  });
}
