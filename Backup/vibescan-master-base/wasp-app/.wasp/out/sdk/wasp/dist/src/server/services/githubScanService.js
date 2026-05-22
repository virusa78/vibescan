import { submitScanSubmission } from "./scanSubmissionService.js";
export async function submitGitHubScan(userId, workspaceId, inputRef, githubContext) {
    return submitScanSubmission({
        userId,
        workspaceId,
        inputType: "github",
        inputRef,
        githubContext,
    });
}
//# sourceMappingURL=githubScanService.js.map