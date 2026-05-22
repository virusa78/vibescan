export type GithubInstallationFilterState = {
  repositorySelection: string;
  reposScope: string[];
  targetBranches: string[];
};

export function isRepositoryAllowedByInstallation(
  installation: GithubInstallationFilterState,
  repositoryFullName: string,
): boolean {
  if (installation.reposScope.length > 0) {
    return installation.reposScope.includes(repositoryFullName);
  }

  if (installation.repositorySelection === 'all') {
    return true;
  }

  return false;
}

export function isTargetBranchAllowedByInstallation(
  installation: GithubInstallationFilterState,
  branch: string | null | undefined,
): boolean {
  if (!branch) {
    return true;
  }

  if (!installation.targetBranches || installation.targetBranches.length === 0) {
    return true;
  }

  return installation.targetBranches.includes(branch);
}

export function isForkPullRequest(headRepositoryFullName: string | null, baseRepositoryFullName: string | null): boolean {
  if (!headRepositoryFullName || !baseRepositoryFullName) {
    return false;
  }

  return headRepositoryFullName !== baseRepositoryFullName;
}
