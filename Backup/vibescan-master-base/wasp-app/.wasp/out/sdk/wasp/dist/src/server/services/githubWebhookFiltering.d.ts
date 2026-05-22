export type GithubInstallationFilterState = {
    repositorySelection: string;
    reposScope: string[];
    targetBranches: string[];
};
export declare function isRepositoryAllowedByInstallation(installation: GithubInstallationFilterState, repositoryFullName: string): boolean;
export declare function isTargetBranchAllowedByInstallation(installation: GithubInstallationFilterState, branch: string | null | undefined): boolean;
export declare function isForkPullRequest(headRepositoryFullName: string | null, baseRepositoryFullName: string | null): boolean;
//# sourceMappingURL=githubWebhookFiltering.d.ts.map