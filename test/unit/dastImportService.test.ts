import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { importDastReportForScan } from '../../wasp-app/src/server/services/dastImportService';

jest.mock('../../wasp-app/src/server/services/scanLifecycleService', () => ({
  finalizeScanIfReady: jest.fn(),
  handleScannerFailure: jest.fn(),
}));

describe('dastImportService', () => {
  const tempRoots: string[] = [];

  afterEach(() => {
    for (const dir of tempRoots.splice(0, tempRoots.length)) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('imports an uploaded DAST report without using scanner registry paths', async () => {
    const tempRoot = mkdtempSync(join(tmpdir(), 'vibescan-dast-'));
    tempRoots.push(tempRoot);
    const reportPath = join(tempRoot, 'zap-report.json');

    writeFileSync(
      reportPath,
      JSON.stringify({
        site: [
          {
            '@name': 'example.com',
            alerts: [
              {
                riskcode: '3',
                pluginid: '10001',
                desc: 'SQL injection',
                instances: [{ uri: '/login' }],
              },
            ],
          },
        ],
      }),
      'utf8',
    );

    const prisma = {
      scan: {
        findUnique: jest.fn() as jest.Mock,
        update: jest.fn() as jest.Mock,
      },
      scanResult: {
        upsert: jest.fn() as jest.Mock,
      },
      finding: {
        findUnique: jest.fn() as jest.Mock,
        upsert: jest.fn() as jest.Mock,
      },
      user: {
        findUnique: jest.fn() as jest.Mock,
      },
    } as any;

    prisma.scan.findUnique.mockResolvedValue({ id: 'scan-1', status: 'pending' });
    prisma.scan.update.mockResolvedValue({});
    prisma.scanResult.upsert.mockResolvedValue({ id: 'scan-result-1' });
    prisma.finding.findUnique.mockResolvedValue(null);
    prisma.finding.upsert.mockResolvedValue({});

    const result = await importDastReportForScan({
      prisma,
      scanId: 'scan-1',
      userId: 'user-1',
      inputRef: reportPath,
    });

    expect(prisma.scan.findUnique).toHaveBeenCalledWith({
      where: { id: 'scan-1' },
      select: { id: true, status: true },
    });
    expect(prisma.scan.update).toHaveBeenCalledWith({
      where: { id: 'scan-1' },
      data: { status: 'scanning' },
    });
    expect(prisma.scanResult.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          scanId_source: {
            scanId: 'scan-1',
            source: 'dast',
          },
        },
        create: expect.objectContaining({
          source: 'dast',
          scannerVersion: 'dast-import',
        }),
      }),
    );
    expect(prisma.finding.upsert).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      findingsCount: 1,
      scanResultId: 'scan-result-1',
    });
  });
});
