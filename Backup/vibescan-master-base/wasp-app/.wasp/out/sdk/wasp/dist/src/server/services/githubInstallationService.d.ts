type GithubInstallationRecord = {
    id: string;
    orgId: string | null;
    workspaceId: string | null;
    githubInstallationId: bigint;
    githubAppId: string;
    accountLogin: string | null;
    accountType: string | null;
    repositorySelection: string;
    reposScope: string[];
    triggerOnPush: boolean;
    triggerOnPr: boolean;
    targetBranches: string[];
    failPrOnSeverity: string;
};
type LinkInstallationResult = {
    id: string;
    githubInstallationId: string;
    workspaceId: string | null;
    orgId: string | null;
    accountLogin: string | null;
    repositorySelection: string;
    reposScope: string[];
    triggerOnPush: boolean;
    triggerOnPr: boolean;
    targetBranches: string[];
    failPrOnSeverity: string;
    availableRepos: string[];
};
export declare function syncGithubInstallation(installationId: string | number | bigint, overrides?: {
    workspaceId?: string | null;
    orgId?: string | null;
}): Promise<LinkInstallationResult>;
export declare function removeGithubInstallation(installationId: string | number | bigint): Promise<void>;
export declare function linkGithubInstallationToWorkspace(installationId: string, workspaceId: string, orgId: string): Promise<LinkInstallationResult>;
export declare function getMappedGithubInstallationByInstallationId(installationId: string | number | bigint): Promise<GithubInstallationRecord | null>;
export declare function listGithubInstallationsForWorkspace(workspaceId: string): Promise<LinkInstallationResult[]>;
export declare function updateGithubInstallationSettings(installationId: string, workspaceId: string, settings: {
    reposScope: string[];
    triggerOnPush: boolean;
    triggerOnPr: boolean;
    targetBranches: string[];
    failPrOnSeverity: string;
}): Promise<LinkInstallationResult>;
export {};
//# sourceMappingURL=githubInstallationService.d.ts.map