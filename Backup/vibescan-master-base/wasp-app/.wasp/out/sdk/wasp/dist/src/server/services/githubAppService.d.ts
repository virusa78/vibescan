export type PersistedGitHubScanContext = {
    source: 'github_app_webhook' | 'github_manual';
    installationId?: string;
    deliveryId?: string;
    checkRunId?: number | null;
    checkRunUrl?: string | null;
    repositoryId?: number;
    repositoryFullName?: string;
    repositoryPrivate?: boolean;
    defaultBranch?: string | null;
    eventType?: 'push' | 'pull_request';
    ref?: string | null;
    branch?: string | null;
    commitSha?: string | null;
    pullRequestNumber?: number | null;
};
export type GitHubInstallationMetadata = {
    installationId: string;
    accountLogin: string | null;
    accountType: string | null;
    repositorySelection: string;
};
export type GitHubInstallationRepository = {
    id: number;
    fullName: string;
    htmlUrl: string;
    defaultBranch: string | null;
    isPrivate: boolean;
};
export type GitHubCheckRunPayload = {
    name: string;
    head_sha: string;
    status: 'queued' | 'in_progress' | 'completed';
    conclusion?: 'success' | 'failure' | 'neutral' | 'cancelled' | 'skipped' | 'timed_out' | 'action_required';
    details_url?: string;
    output?: {
        title: string;
        summary: string;
    };
};
export declare function verifyGitHubWebhookSignature(payload: Buffer | string, signatureHeader: string | undefined): boolean;
export declare function createGitHubInstallationAccessToken(installationId: number | bigint | string): Promise<string>;
export declare function getGitHubInstallationMetadata(installationId: number | bigint | string): Promise<GitHubInstallationMetadata>;
export declare function listGitHubInstallationRepositories(installationId: number | bigint | string): Promise<GitHubInstallationRepository[]>;
export declare function createGitHubCheckRun(installationId: number | bigint | string, repositoryFullName: string, body: GitHubCheckRunPayload): Promise<{
    id: number;
    html_url?: string | null;
}>;
export declare function updateGitHubCheckRun(installationId: number | bigint | string, repositoryFullName: string, checkRunId: number | string, body: Omit<GitHubCheckRunPayload, 'name' | 'head_sha'> & {
    details_url?: string;
}): Promise<{
    id: number;
    html_url?: string | null;
}>;
//# sourceMappingURL=githubAppService.d.ts.map