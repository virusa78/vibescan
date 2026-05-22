export type GithubInstallationSummary = {
    id: string;
    github_installation_id: string;
    workspace_id: string | null;
    org_id: string | null;
    account_login: string | null;
    repository_selection: string;
    repos_scope: string[];
    trigger_on_push: boolean;
    trigger_on_pr: boolean;
    target_branches: string[];
    fail_pr_on_severity: string;
    available_repos: string[];
};
export declare function listGithubInstallations(_rawArgs: unknown, context: any): Promise<{
    installations: GithubInstallationSummary[];
}>;
//# sourceMappingURL=listGithubInstallations.d.ts.map