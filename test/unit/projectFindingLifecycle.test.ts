import { describe, expect, it, jest } from '@jest/globals';
import {
  buildProjectFindingFingerprint,
  calculateSlaDueAt,
  calculateSlaState,
  normalizeProjectTarget,
  resolveProjectForScanInput,
  persistProjectFindingsForScan,
  markProjectFindingsMitigatedForCompletedScan,
} from '../../wasp-app/src/server/services/projectFindingLifecycleService';

describe('project finding lifecycle helpers', () => {
  it('normalizes GitHub URLs to stable owner/repo project identity', () => {
    const target = normalizeProjectTarget('github', 'https://github.com/OpenAI/Example.git');

    expect(target).toMatchObject({
      name: 'OpenAI/Example',
      slug: 'openai-example',
      targetType: 'github',
      normalizedTargetRef: 'openai/example',
    });
  });

  it('normalizes GitHub SSH URLs successfully', () => {
    const target = normalizeProjectTarget('github', 'git@github.com:OpenAI/Example.git');

    expect(target).toMatchObject({
      name: 'OpenAI/Example',
      slug: 'openai-example',
      targetType: 'github',
      normalizedTargetRef: 'openai/example',
    });
  });

  it('falls back to basename for non-URL inputs or unparseable URLs', () => {
    const target = normalizeProjectTarget('sbom', 'my-project-sbom.json');
    expect(target).toMatchObject({
      name: 'my-project-sbom',
      slug: 'my-project-sbom',
      targetType: 'sbom',
      normalizedTargetRef: 'sbom:my-project-sbom.json',
    });
  });

  it('normalizes upload inputs from filenames', () => {
    const target = normalizeProjectTarget('sbom_upload', '/tmp/uploads/service-a.cdx.json');

    expect(target.name).toBe('service-a.cdx');
    expect(target.targetType).toBe('sbom');
    expect(target.normalizedTargetRef).toBe('sbom:/tmp/uploads/service-a.cdx.json');
  });

  it('normalizes upload inputs from unique names by cleaning upload timestamp prefix', () => {
    const target = normalizeProjectTarget('sbom_upload', 'upload-1779789626772-service-a.cdx.json');

    expect(target.name).toBe('service-a.cdx');
    expect(target.targetType).toBe('sbom');
    expect(target.targetRef).toBe('service-a.cdx.json');
    expect(target.normalizedTargetRef).toBe('sbom:service-a.cdx.json');
  });

  it('uses CVE package version and path for stable aggregate fingerprints', () => {
    const first = buildProjectFindingFingerprint({
      cveId: 'CVE-2026-1234',
      package: 'lodash',
      version: '4.17.20',
      filePath: './package-lock.json',
    });
    const second = buildProjectFindingFingerprint({
      cveId: 'CVE-2026-1234',
      package: 'lodash',
      version: '4.17.20',
      filePath: 'package-lock.json',
    });

    expect(first).toBe(second);
  });

  it('calculates severity based SLA state', () => {
    const firstSeenAt = new Date('2026-05-01T00:00:00.000Z');
    const criticalDueAt = calculateSlaDueAt('CRITICAL', firstSeenAt);

    expect(criticalDueAt?.toISOString()).toBe('2026-05-08T00:00:00.000Z');
    expect(calculateSlaState(criticalDueAt, new Date('2026-05-09T00:00:00.000Z'))).toBe('overdue');
    expect(calculateSlaState(criticalDueAt, new Date('2026-05-03T00:00:00.000Z'))).toBe('due_soon');
    expect(calculateSlaDueAt('INFO', firstSeenAt)).toBeNull();
  });
});

describe('project finding lifecycle database actions', () => {
  it('resolves a project for scan input using upsert', async () => {
    const upsertMock = jest.fn(() => Promise.resolve({ id: 'project-123' }));
    const mockPrisma = {
      project: {
        upsert: upsertMock,
      },
    } as any;

    const result = await resolveProjectForScanInput(mockPrisma, {
      workspaceId: 'workspace-99',
      inputType: 'github',
      inputRef: 'https://github.com/some/repo.git',
    });

    expect(result).toEqual({ id: 'project-123' });
    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          workspaceId_normalizedTargetRef: {
            workspaceId: 'workspace-99',
            normalizedTargetRef: 'some/repo',
          },
        },
      })
    );
  });

  it('returns early when persisting findings if scan details are invalid', async () => {
    const findUniqueMock = jest.fn(() => Promise.resolve(null as any));
    const mockPrisma = {
      scan: {
        findUnique: findUniqueMock,
      },
    } as any;

    await expect(
      persistProjectFindingsForScan({
        prisma: mockPrisma,
        scanId: 'invalid-scan',
        source: 'grype' as any,
        findings: [],
      })
    ).resolves.not.toThrow();
  });

  it('creates new project findings when they do not exist', async () => {
    const mockScan = {
      id: 'scan-1',
      projectId: 'project-1',
      workspaceId: 'workspace-1',
      completedAt: new Date('2026-05-25T12:00:00.000Z'),
    };

    const findUniqueScanMock = jest.fn(() => Promise.resolve(mockScan));
    const findUniqueFindingMock = jest.fn(() => Promise.resolve(null as any));
    const createFindingMock = jest.fn(() => Promise.resolve({} as any));

    const mockPrisma = {
      scan: {
        findUnique: findUniqueScanMock,
      },
      projectFinding: {
        findUnique: findUniqueFindingMock,
        create: createFindingMock,
      },
    } as any;

    await persistProjectFindingsForScan({
      prisma: mockPrisma,
      scanId: 'scan-1',
      source: 'grype' as any,
      findings: [
        {
          cveId: 'CVE-2026-9999',
          package: 'test-pkg',
          version: '1.0.0',
          filePath: './package.json',
          severity: 'critical',
          cvssScore: 9.8,
          fixedVersion: '1.0.1',
          description: 'A test vulnerability',
        },
      ],
    });

    expect(findUniqueFindingMock).toHaveBeenCalled();
    expect(createFindingMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          workspaceId: 'workspace-1',
          projectId: 'project-1',
          cveId: 'CVE-2026-9999',
          packageName: 'test-pkg',
          severity: 'CRITICAL',
          status: 'active',
        }),
      })
    );
  });

  it('updates existing project findings and manages increments', async () => {
    const mockScan = {
      id: 'scan-1',
      projectId: 'project-1',
      workspaceId: 'workspace-1',
      completedAt: new Date('2026-05-25T12:00:00.000Z'),
    };

    const existingFinding = {
      id: 'pf-1',
      status: 'mitigated',
      firstSeenAt: new Date('2026-05-20T12:00:00.000Z'),
      lastScanId: 'scan-old',
      scanCount: 1,
      reportedBy: ['snyk'],
    };

    const findUniqueScanMock = jest.fn(() => Promise.resolve(mockScan));
    const findUniqueFindingMock = jest.fn(() => Promise.resolve(existingFinding as any));
    const updateFindingMock = jest.fn(() => Promise.resolve({} as any));

    const mockPrisma = {
      scan: {
        findUnique: findUniqueScanMock,
      },
      projectFinding: {
        findUnique: findUniqueFindingMock,
        update: updateFindingMock,
      },
    } as any;

    await persistProjectFindingsForScan({
      prisma: mockPrisma,
      scanId: 'scan-1',
      source: 'grype' as any,
      findings: [
        {
          cveId: 'CVE-2026-9999',
          package: 'test-pkg',
          version: '1.0.0',
          filePath: './package.json',
          severity: 'high',
          cvssScore: 8.8,
          fixedVersion: '1.0.1',
          description: 'A test vulnerability',
        },
      ],
    });

    expect(updateFindingMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'pf-1' },
        data: expect.objectContaining({
          status: 'active', // reopened
          scanCount: { increment: 1 },
          reportedBy: ['grype', 'snyk'],
        }),
      })
    );
  });

  it('mitigates project findings not found in completed scan', async () => {
    const mockScan = {
      id: 'scan-1',
      projectId: 'project-1',
      workspaceId: 'workspace-1',
    };

    const findUniqueScanMock = jest.fn(() => Promise.resolve(mockScan));
    const findManyFindingsMock = jest.fn(() => Promise.resolve([
      { fingerprint: 'fp-1' },
    ]));
    const updateManyMock = jest.fn(() => Promise.resolve({ count: 1 } as any));

    const mockPrisma = {
      scan: {
        findUnique: findUniqueScanMock,
      },
      finding: {
        findMany: findManyFindingsMock,
      },
      projectFinding: {
        updateMany: updateManyMock,
      },
    } as any;

    await markProjectFindingsMitigatedForCompletedScan({
      prisma: mockPrisma,
      scanId: 'scan-1',
      completedAt: new Date('2026-05-25T13:00:00.000Z'),
    });

    expect(updateManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          workspaceId: 'workspace-1',
          projectId: 'project-1',
          fingerprint: { notIn: ['fp-1'] },
        }),
        data: expect.objectContaining({
          status: 'mitigated',
        }),
      })
    );
  });

  it('mitigates all findings if scan contains zero findings', async () => {
    const mockScan = {
      id: 'scan-1',
      projectId: 'project-1',
      workspaceId: 'workspace-1',
    };

    const findUniqueScanMock = jest.fn(() => Promise.resolve(mockScan));
    const findManyFindingsMock = jest.fn(() => Promise.resolve([]));
    const updateManyMock = jest.fn(() => Promise.resolve({ count: 1 } as any));

    const mockPrisma = {
      scan: {
        findUnique: findUniqueScanMock,
      },
      finding: {
        findMany: findManyFindingsMock,
      },
      projectFinding: {
        updateMany: updateManyMock,
      },
    } as any;

    await markProjectFindingsMitigatedForCompletedScan({
      prisma: mockPrisma,
      scanId: 'scan-1',
      completedAt: new Date('2026-05-25T13:00:00.000Z'),
    });

    expect(updateManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          workspaceId: 'workspace-1',
          projectId: 'project-1',
          status: { not: 'mitigated' },
        },
      })
    );
  });

  it('returns early when mitigating if scan is invalid', async () => {
    const findUniqueScanMock = jest.fn(() => Promise.resolve(null as any));
    const mockPrisma = {
      scan: {
        findUnique: findUniqueScanMock,
      },
    } as any;

    await expect(
      markProjectFindingsMitigatedForCompletedScan({
        prisma: mockPrisma,
        scanId: 'invalid-scan',
        completedAt: new Date(),
      })
    ).resolves.not.toThrow();
  });
});

