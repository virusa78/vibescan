import { jest } from '@jest/globals';

export type GitHubInstallationRecord = {
  githubInstallationId: bigint;
  workspaceId: string;
  repositorySelection: 'all' | 'selected';
  reposScope: string[];
  triggerOnPush: boolean;
  triggerOnPr: boolean;
  targetBranches: string[];
};

export type GitHubCheckRunRecord = {
  id: number;
  installationId: string;
  repositoryFullName: string;
  headSha: string;
  status: 'queued' | 'in_progress' | 'completed';
  conclusion?: 'success' | 'failure' | null;
  detailsUrl?: string | null;
  title?: string;
  summary?: string;
};

export type GitHubScanRecord = {
  id: string;
  workspaceId: string;
  userId: string;
  inputRef: string;
  status: string;
  githubContext: Record<string, unknown> | null;
};

export type GitHubWebhookResponse = {
  statusCode?: number;
  body?: unknown;
};

export type GitHubIntegrationScenario = {
  id: string;
  title: string;
  description: string;
};

export function buildPushWebhookPayload(input: {
  installationId: number;
  repositoryFullName: string;
  repositoryHtmlUrl: string;
  defaultBranch?: string;
  branch?: string;
  after?: string;
  deleted?: boolean;
}): Record<string, unknown> {
  return {
    installation: { id: input.installationId },
    ref: `refs/heads/${input.branch ?? input.defaultBranch ?? 'main'}`,
    deleted: input.deleted ?? false,
    after: input.after ?? 'abc123',
    repository: {
      id: 10,
      full_name: input.repositoryFullName,
      html_url: input.repositoryHtmlUrl,
      default_branch: input.defaultBranch ?? 'main',
      private: true,
    },
  };
}

export function buildPullRequestWebhookPayload(input: {
  installationId: number;
  repositoryFullName: string;
  repositoryHtmlUrl: string;
  action?: string;
  prNumber?: number;
  headRepositoryFullName?: string;
  headRef?: string;
  headSha?: string;
  baseRef?: string;
}): Record<string, unknown> {
  return {
    installation: { id: input.installationId },
    action: input.action ?? 'opened',
    number: input.prNumber ?? 7,
    repository: {
      id: 10,
      full_name: input.repositoryFullName,
      html_url: input.repositoryHtmlUrl,
      default_branch: input.baseRef ?? 'main',
      private: true,
    },
    pull_request: {
      head: {
        ref: input.headRef ?? 'feature-x',
        sha: input.headSha ?? 'def456',
        repo: {
          full_name: input.headRepositoryFullName ?? input.repositoryFullName,
        },
      },
      base: {
        ref: input.baseRef ?? 'main',
      },
    },
  };
}

export function buildInstallationWebhookPayload(input: {
  installationId: number;
  action?: 'created' | 'deleted' | 'new_permissions_accepted';
}): Record<string, unknown> {
  return {
    installation: { id: input.installationId },
    action: input.action ?? 'created',
  };
}

function createResponse() {
  const response = {
    statusCode: undefined as number | undefined,
    body: undefined as unknown,
    status: jest.fn(function status(code: number) {
      response.statusCode = code;
      return response;
    }),
    json: jest.fn(function json(payload: unknown) {
      response.body = payload;
      return response;
    }),
  };

  return response;
}

export function createGitHubIntegrationHarness() {
  const transcript: string[] = [];
  const installations = new Map<string, GitHubInstallationRecord>();
  const workspaces = new Map<string, { createdByUserId: string }>();
  const scans = new Map<string, GitHubScanRecord>();
  const checkRuns = new Map<string, GitHubCheckRunRecord>();
  let nextScanId = 1;
  let nextCheckRunId = 100;

  const prisma = {
    workspace: {
      findUnique: jest.fn(async ({ where }: { where: { id: string } }) => workspaces.get(where.id) ?? null),
    },
    scan: {
      findFirst: jest.fn(async ({ where }: { where: { workspaceId?: string; githubContext?: { path?: string[]; equals?: string } } }) => {
        const deliveryId = where.githubContext?.equals;
        if (!deliveryId) return null;
        for (const scan of scans.values()) {
          if (where.workspaceId && scan.workspaceId !== where.workspaceId) continue;
          if ((scan.githubContext?.deliveryId as string | undefined) === deliveryId) {
            return { id: scan.id };
          }
        }
        return null;
      }),
      findUnique: jest.fn(async ({ where }: { where: { id: string } }) => {
        const scan = scans.get(where.id);
        if (!scan) return null;
        return {
          id: scan.id,
          status: scan.status,
          githubContext: scan.githubContext,
        };
      }),
      update: jest.fn(async ({ where, data }: { where: { id: string }; data: { githubContext?: Record<string, unknown> } }) => {
        const scan = scans.get(where.id);
        if (!scan) return null;
        if (data.githubContext) {
          scan.githubContext = data.githubContext;
        }
        return scan;
      }),
    },
    githubInstallation: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
    },
  };

  const verifyGitHubWebhookSignature = jest.fn(() => true);

  const getMappedGithubInstallationByInstallationId = jest.fn(async (installationId: string | number) => {
    const record = installations.get(String(installationId));
    return record ?? null;
  });

  const syncGithubInstallation = jest.fn(async (installationId: string | number) => {
    transcript.push(`installation:sync:${String(installationId)}`);
  });

  const removeGithubInstallation = jest.fn(async (installationId: string | number) => {
    transcript.push(`installation:remove:${String(installationId)}`);
    installations.delete(String(installationId));
  });

  const submitGitHubScan = jest.fn(async (
    userId: string,
    workspaceId: string,
    repositoryHtmlUrl: string,
    githubContext: unknown,
  ) => {
    const id = `scan-${nextScanId}`;
    nextScanId += 1;
    scans.set(id, {
      id,
      workspaceId,
      userId,
      inputRef: repositoryHtmlUrl,
      status: 'pending',
      githubContext: githubContext && typeof githubContext === 'object' && !Array.isArray(githubContext)
        ? (githubContext as Record<string, unknown>)
        : null,
    });
    transcript.push(`scan:created:${id}`);
    return { scan: { id } };
  });

  const createGitHubCheckRun = jest.fn(async (
    installationId: string,
    repositoryFullName: string,
    payload: {
      name?: string;
      head_sha?: string;
      status?: 'queued' | 'in_progress' | 'completed';
      conclusion?: 'success' | 'failure';
      details_url?: string;
      output?: { title?: string; summary?: string };
    },
  ) => {
    const id = nextCheckRunId;
    nextCheckRunId += 1;
    checkRuns.set(`${installationId}:${repositoryFullName}:${id}`, {
      id,
      installationId,
      repositoryFullName,
      headSha: payload.head_sha ?? 'unknown',
      status: payload.status ?? 'queued',
      conclusion: payload.conclusion ?? null,
      detailsUrl: payload.details_url ?? null,
      title: payload.output?.title,
      summary: payload.output?.summary,
    });
    transcript.push(`check-run:create:${id}:${payload.status ?? 'queued'}`);
    return { id, html_url: `https://github.com/${repositoryFullName}/runs/${id}` };
  });

  const updateGitHubCheckRun = jest.fn(async (
    installationId: string,
    repositoryFullName: string,
    checkRunId: number | string,
    payload: {
      status?: 'queued' | 'in_progress' | 'completed';
      conclusion?: 'success' | 'failure';
      details_url?: string;
      output?: { title?: string; summary?: string };
    },
  ) => {
    const key = `${installationId}:${repositoryFullName}:${String(checkRunId)}`;
    const record = checkRuns.get(key);
    if (record) {
      record.status = payload.status ?? record.status;
      record.conclusion = payload.conclusion ?? record.conclusion ?? null;
      record.detailsUrl = payload.details_url ?? record.detailsUrl ?? null;
      record.title = payload.output?.title ?? record.title;
      record.summary = payload.output?.summary ?? record.summary;
    }
    transcript.push(`check-run:update:${String(checkRunId)}:${payload.status ?? 'unknown'}`);
    return { id: Number(checkRunId), html_url: `https://github.com/${repositoryFullName}/runs/${String(checkRunId)}` };
  });

  function seedInstallation(record: GitHubInstallationRecord): void {
    installations.set(record.githubInstallationId.toString(), record);
  }

  function seedWorkspace(id: string, createdByUserId: string): void {
    workspaces.set(id, { createdByUserId });
  }

  function reset(): void {
    transcript.length = 0;
    installations.clear();
    workspaces.clear();
    scans.clear();
    checkRuns.clear();
    nextScanId = 1;
    nextCheckRunId = 100;
  }

  function seedScan(record: GitHubScanRecord): void {
    scans.set(record.id, record);
  }

  function getScan(id: string): GitHubScanRecord | undefined {
    return scans.get(id);
  }

  function getCheckRun(id: number): GitHubCheckRunRecord | undefined {
    for (const record of checkRuns.values()) {
      if (record.id === id) return record;
    }
    return undefined;
  }

  function createRequest(input: {
    event: string;
    deliveryId: string;
    payload: Record<string, unknown>;
    signature?: string;
  }) {
    return {
      headers: {
        'x-hub-signature-256': input.signature ?? 'sha256=ok',
        'x-github-event': input.event,
        'x-github-delivery': input.deliveryId,
      },
      body: input.payload,
    };
  }

  function createResponseStub() {
    return createResponse();
  }

  return {
    prisma,
    transcript,
    verifyGitHubWebhookSignature,
    getMappedGithubInstallationByInstallationId,
    syncGithubInstallation,
    removeGithubInstallation,
    submitGitHubScan,
    createGitHubCheckRun,
    updateGitHubCheckRun,
    seedInstallation,
    seedWorkspace,
    seedScan,
    reset,
    getScan,
    getCheckRun,
    createRequest,
    createResponseStub,
  };
}

export function getGitHubIntegrationScenarioMenu(): GitHubIntegrationScenario[] {
  return [
    {
      id: 'push-flow',
      title: 'Push flow',
      description: 'Webhook -> scan -> queued/in_progress/completed check runs.',
    },
    {
      id: 'fork-pr-ignore',
      title: 'Fork PR ignore',
      description: 'Fork pull requests are skipped before scan submission.',
    },
    {
      id: 'install-sync',
      title: 'Install sync',
      description: 'installation and installation_repositories events sync mappings.',
    },
    {
      id: 'duplicate-delivery',
      title: 'Duplicate delivery',
      description: 'Repeated delivery IDs are ignored cleanly.',
    },
    {
      id: 'branch-scope',
      title: 'Branch scope',
      description: 'Pull requests outside target branch scope are ignored.',
    },
    {
      id: 'deleted-install',
      title: 'Deleted install',
      description: 'Deleted installations do not accept later webhook scans.',
    },
  ];
}
