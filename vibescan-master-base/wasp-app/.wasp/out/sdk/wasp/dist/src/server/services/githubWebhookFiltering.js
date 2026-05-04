export function isRepositoryAllowedByInstallation(installation, repositoryFullName) {
    if (installation.reposScope.length > 0) {
        return installation.reposScope.includes(repositoryFullName);
    }
    if (installation.repositorySelection === 'all') {
        return true;
    }
    return false;
}
export function isTargetBranchAllowedByInstallation(installation, branch) {
    if (!branch) {
        return true;
    }
    if (!installation.targetBranches || installation.targetBranches.length === 0) {
        return true;
    }
    return installation.targetBranches.includes(branch);
}
export function isForkPullRequest(headRepositoryFullName, baseRepositoryFullName) {
    if (!headRepositoryFullName || !baseRepositoryFullName) {
        return false;
    }
    return headRepositoryFullName !== baseRepositoryFullName;
}
//# sourceMappingURL=githubWebhookFiltering.js.map