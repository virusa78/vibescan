import { describe, expect, it } from '@jest/globals';
import {
  isForkPullRequest,
  isRepositoryAllowedByInstallation,
  isTargetBranchAllowedByInstallation,
} from '../../wasp-app/src/server/services/githubWebhookFiltering';

describe('githubWebhookFiltering', () => {
  const installation = {
    repositorySelection: 'selected',
    reposScope: ['acme/api', 'acme/web'],
    targetBranches: ['main', 'release'],
  };

  it('allows repositories that are explicitly enabled', () => {
    expect(isRepositoryAllowedByInstallation(installation, 'acme/api')).toBe(true);
    expect(isRepositoryAllowedByInstallation(installation, 'acme/other')).toBe(false);
  });

  it('allows all repositories when selection is all and no explicit scope is stored', () => {
    expect(
      isRepositoryAllowedByInstallation(
        {
          repositorySelection: 'all',
          reposScope: [],
          targetBranches: [],
        },
        'acme/any-repo',
      ),
    ).toBe(true);
  });

  it('filters branches against target branch list', () => {
    expect(isTargetBranchAllowedByInstallation(installation, 'main')).toBe(true);
    expect(isTargetBranchAllowedByInstallation(installation, 'feature-x')).toBe(false);
  });

  it('allows branch-less events and installations without explicit branch list', () => {
    expect(isTargetBranchAllowedByInstallation(installation, null)).toBe(true);
    expect(
      isTargetBranchAllowedByInstallation(
        {
          repositorySelection: 'all',
          reposScope: [],
          targetBranches: [],
        },
        'feature-x',
      ),
    ).toBe(true);
  });

  it('detects fork pull requests by comparing head and base repositories', () => {
    expect(isForkPullRequest('fork-user/api', 'acme/api')).toBe(true);
    expect(isForkPullRequest('acme/api', 'acme/api')).toBe(false);
    expect(isForkPullRequest(null, 'acme/api')).toBe(false);
  });
});
