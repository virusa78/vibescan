import { afterAll, afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { PrismaClient } from '../../wasp-app/node_modules/@prisma/client';

process.env.DATABASE_URL ||= 'postgresql://vibescan:vibescan@localhost:5432/vibescan';

const prisma = new PrismaClient();

jest.mock('wasp/server', () => ({
  prisma,
  HttpError: class HttpError extends Error {
    statusCode: number;
    data?: Record<string, unknown>;

    constructor(statusCode: number, message: string, data?: Record<string, unknown>) {
      super(message);
      this.statusCode = statusCode;
      this.data = data;
    }
  },
}));

jest.mock('../../wasp-app/src/server/operations/scans/orchestrator', () => ({
  orchestrateScan: jest.fn(() => Promise.resolve()),
}));

jest.mock('../../wasp-app/src/server/queues/config', () => ({
  initializeWorkers: jest.fn(() => Promise.resolve()),
}));

jest.mock('../../wasp-app/src/server/services/scanTimeoutService', () => ({
  startScanTimeoutSweeper: jest.fn(),
}));

import { submitScanSubmission } from '../../wasp-app/src/server/services/scanSubmissionService';
import { orchestrateScan } from '../../wasp-app/src/server/operations/scans/orchestrator';
import { initializeWorkers } from '../../wasp-app/src/server/queues/config';
import { startScanTimeoutSweeper } from '../../wasp-app/src/server/services/scanTimeoutService';

const mockedOrchestrateScan = orchestrateScan as jest.MockedFunction<typeof orchestrateScan>;
const mockedInitializeWorkers = initializeWorkers as jest.MockedFunction<typeof initializeWorkers>;
const mockedStartScanTimeoutSweeper = startScanTimeoutSweeper as jest.MockedFunction<typeof startScanTimeoutSweeper>;
const prismaWithScannerUsageLedger = prisma as PrismaClient & {
  scannerUsageLedger?: {
    deleteMany: (args: { where: { userId: string } }) => Promise<unknown>;
  };
};

const trackedEnv = {
  VIBESCAN_ENABLE_SNYK_SCANNER: process.env.VIBESCAN_ENABLE_SNYK_SCANNER,
  VIBESCAN_SNYK_CREDENTIAL_MODE: process.env.VIBESCAN_SNYK_CREDENTIAL_MODE,
  SNYK_TOKEN: process.env.SNYK_TOKEN,
  SNYK_ORG_ID: process.env.SNYK_ORG_ID,
  SHOULD_EMBED_WORKERS: process.env.SHOULD_EMBED_WORKERS,
};

describe('Snyk scan planning integration', () => {
  let userId = '';
  let orgId = '';
  let workspaceId = '';

  beforeEach(async () => {
    process.env.VIBESCAN_ENABLE_SNYK_SCANNER = 'true';
    delete process.env.VIBESCAN_SNYK_CREDENTIAL_MODE;
    process.env.SNYK_TOKEN = 'integration-snyk-token';
    process.env.SNYK_ORG_ID = 'org-123';
    process.env.SHOULD_EMBED_WORKERS = 'false';

    mockedOrchestrateScan.mockClear();
    mockedInitializeWorkers.mockClear();
    mockedStartScanTimeoutSweeper.mockClear();

    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const user = await prisma.user.create({
      data: {
        email: `snyk-planning-${suffix}@example.com`,
        username: `snyk-planning-${suffix}`,
        plan: 'pro',
      },
    });
    userId = user.id;

    const organization = await prisma.organization.create({
      data: {
        name: `Snyk Planning Org ${suffix}`,
        slug: `snyk-planning-org-${suffix}`,
        ownerUserId: user.id,
      },
    });
    orgId = organization.id;

    const workspace = await prisma.workspace.create({
      data: {
        name: `Snyk Planning Workspace ${suffix}`,
        slug: `snyk-planning-workspace-${suffix}`,
        organizationId: organization.id,
        createdByUserId: user.id,
        isPersonal: true,
      },
    });
    workspaceId = workspace.id;
  });

  afterEach(async () => {
    if (userId) {
      await prisma.quotaLedger.deleteMany({ where: { userId } });
      await prismaWithScannerUsageLedger.scannerUsageLedger?.deleteMany({ where: { userId } });
      await prisma.scanDelta.deleteMany({ where: { scan: { userId } } });
      await prisma.scanResult.deleteMany({ where: { scan: { userId } } });
      await prisma.scan.deleteMany({ where: { userId } });
      await prisma.workspaceMembership.deleteMany({ where: { userId } });
      await prisma.workspace.deleteMany({ where: { id: workspaceId } });
      await prisma.organization.deleteMany({ where: { id: orgId } });
      await prisma.user.deleteMany({ where: { id: userId } });
    }

    process.env.VIBESCAN_ENABLE_SNYK_SCANNER = trackedEnv.VIBESCAN_ENABLE_SNYK_SCANNER;
    process.env.VIBESCAN_SNYK_CREDENTIAL_MODE = trackedEnv.VIBESCAN_SNYK_CREDENTIAL_MODE;
    process.env.SNYK_TOKEN = trackedEnv.SNYK_TOKEN;
    process.env.SNYK_ORG_ID = trackedEnv.SNYK_ORG_ID;
    process.env.SHOULD_EMBED_WORKERS = trackedEnv.SHOULD_EMBED_WORKERS;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('schedules all scanners for pro scans when snyk is enabled and ready', async () => {
    const result = await submitScanSubmission({
      userId,
      workspaceId,
      inputType: 'github',
      inputRef: 'https://github.com/revokslab/ShipFree',
    });

    expect(result.scan.planAtSubmission).toBe('pro');
    expect(result.scan.plannedSources).toEqual([
      'grype',
      'trivy',
      'codescoring_johnny',
      'owasp',
      'snyk',
    ]);
    expect(mockedOrchestrateScan).toHaveBeenCalledTimes(1);

    const orchestratorArgs = mockedOrchestrateScan.mock.calls[0][0];
    expect(orchestratorArgs.planAtSubmission).toBe('pro');
    expect(orchestratorArgs.plannedExecutions.map((execution) => execution.provider)).toEqual([
      'grype',
      'trivy',
      'codescoring-johnny',
      'owasp',
      'snyk',
    ]);
    expect(orchestratorArgs.plannedExecutions.find((execution) => execution.provider === 'snyk'))
      .toMatchObject({
        provider: 'snyk',
        resultSource: 'snyk',
        queueTarget: 'enterprise',
      });
  });

  it('schedules snyk for enterprise scans when snyk is enabled and ready', async () => {
    await prisma.user.update({
      where: { id: userId },
      data: { plan: 'enterprise' },
    });

    const result = await submitScanSubmission({
      userId,
      workspaceId,
      inputType: 'github',
      inputRef: 'https://github.com/revokslab/ShipFree',
    });

    expect(result.scan.planAtSubmission).toBe('enterprise');
    expect(result.scan.plannedSources).toEqual(['grype', 'trivy', 'snyk']);
    expect(mockedOrchestrateScan).toHaveBeenCalledTimes(1);

    const orchestratorArgs = mockedOrchestrateScan.mock.calls[0][0];
    expect(orchestratorArgs.planAtSubmission).toBe('enterprise');
    expect(orchestratorArgs.plannedExecutions.map((execution) => execution.provider)).toEqual([
      'grype',
      'trivy',
      'codescoring-johnny',
      'owasp',
      'snyk',
    ]);
    expect(orchestratorArgs.plannedExecutions.find((execution) => execution.provider === 'snyk'))
      .toMatchObject({
        provider: 'snyk',
        resultSource: 'snyk',
        queueTarget: 'enterprise',
      });
  });

  it('enforces starter-level codescoring limit through the backend ledger', async () => {
    await prisma.user.update({
      where: { id: userId },
      data: { plan: 'starter' },
    });

    const first = await submitScanSubmission({
      userId,
      workspaceId,
      inputType: 'github',
      inputRef: 'https://github.com/revokslab/ShipFree',
    });

    expect(first.scan.plannedSources).toEqual([
      'grype',
      'trivy',
      'codescoring_johnny',
      'owasp',
      'snyk',
    ]);

    await expect(
      submitScanSubmission({
        userId,
        workspaceId,
        inputType: 'github',
        inputRef: 'https://github.com/revokslab/ShipFree',
      }),
    ).rejects.toMatchObject({
      statusCode: 429,
      message: 'Scanner monthly limit exceeded',
    });

    expect(mockedOrchestrateScan).toHaveBeenCalledTimes(1);
  });
});
