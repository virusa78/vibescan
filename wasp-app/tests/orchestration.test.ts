import { describe, it, expect, beforeEach, jest } from '@jest/globals';

// We mock it using virtual module via jest.mock and we wrap factory variables
const mockScanUpdate = jest.fn();
const mockScanUpdateMany = jest.fn();

jest.mock('@prisma/client', () => {
  return {
    PrismaClient: jest.fn(() => ({
      scan: {
        update: mockScanUpdate,
        updateMany: mockScanUpdateMany,
      },
    }))
  };
}, { virtual: true });

jest.mock('../src/server/queues/config', () => {
  return {
    initializeWorkers: jest.fn(),
    freeScanQueue: {
      add: jest.fn(),
      getJobs: jest.fn(),
    },
    enterpriseScanQueue: {
      add: jest.fn(),
      getJobs: jest.fn(),
    },
  };
});

import { orchestrateScan, cancelScan, getScanQueueStatus } from '../src/server/operations/scans/orchestrator';
import { PrismaClient } from '@prisma/client';
import { freeScanQueue, enterpriseScanQueue, initializeWorkers } from '../src/server/queues/config';

describe('Dual-Scanner Orchestration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('orchestrateScan', () => {
    it('should orchestrate scan for free plan (only free scanner)', async () => {
      (freeScanQueue.add as any).mockResolvedValue({ id: 'free-job-1', getState: async () => 'waiting' });
      mockScanUpdate.mockResolvedValue({});

      const result = await orchestrateScan({
        scanId: 'scan-1',
        userId: 'user-1',
        inputType: 'source_zip',
        inputRef: 'ref-1',
        planAtSubmission: 'free',
      });

      expect(initializeWorkers).toHaveBeenCalled();
      expect(freeScanQueue.add).toHaveBeenCalledWith(
        'scan-scan-1',
        {
          scanId: 'scan-1',
          userId: 'user-1',
          inputType: 'source_zip',
          inputRef: 'ref-1',
          s3Bucket: 'scans/scan-1',
        },
        { priority: 10 }
      );
      expect(enterpriseScanQueue.add).not.toHaveBeenCalled();
      expect(mockScanUpdate).toHaveBeenCalledWith({
        where: { id: 'scan-1' },
        data: expect.objectContaining({ status: 'scanning' }),
      });

      expect(result).toEqual({
        scanId: 'scan-1',
        freeJobId: 'free-job-1',
        enterpriseJobId: undefined,
        freeQueuePosition: 1,
        enterpriseQueuePosition: undefined,
        status: 'enqueued',
      });
    });

    it('should orchestrate scan for enterprise plan (both scanners)', async () => {
      (freeScanQueue.add as any).mockResolvedValue({ id: 'free-job-2', getState: async () => 'active' });
      (enterpriseScanQueue.add as any).mockResolvedValue({ id: 'ent-job-2', getState: async () => 'waiting' });
      mockScanUpdate.mockResolvedValue({});

      const result = await orchestrateScan({
        scanId: 'scan-2',
        userId: 'user-2',
        inputType: 'github_app',
        inputRef: 'repo/ref',
        planAtSubmission: 'enterprise',
      });

      expect(initializeWorkers).toHaveBeenCalled();
      expect(freeScanQueue.add).toHaveBeenCalled();
      expect(enterpriseScanQueue.add).toHaveBeenCalledWith(
        'scan-scan-2',
        expect.objectContaining({ scanId: 'scan-2' }),
        { priority: 100 }
      );

      expect(result).toEqual({
        scanId: 'scan-2',
        freeJobId: 'free-job-2',
        enterpriseJobId: 'ent-job-2',
        freeQueuePosition: 0, // 'active' -> 0
        enterpriseQueuePosition: 1, // 'waiting' -> 1
        status: 'enqueued',
      });
    });

    it('should handle free scanner enqueue failure', async () => {
      (freeScanQueue.add as any).mockRejectedValue(new Error('Queue connection failed'));
      mockScanUpdate.mockResolvedValue({});

      await expect(
        orchestrateScan({
          scanId: 'scan-error',
          userId: 'user-1',
          inputType: 'source_zip',
          inputRef: 'ref-1',
          planAtSubmission: 'free',
        })
      ).rejects.toThrow('Failed to enqueue free scanner: Queue connection failed');

      expect(mockScanUpdate).toHaveBeenCalledWith({
        where: { id: 'scan-error' },
        data: expect.objectContaining({ status: 'error' }),
      });
    });
  });

  describe('cancelScan', () => {
    it('should cancel pending scan and remove jobs', async () => {
      mockScanUpdateMany.mockResolvedValue({ count: 1 });

      const mockFreeJob = { id: 'fj-1', data: { scanId: 'scan-c1' }, remove: jest.fn().mockResolvedValue(true) };
      const mockFreeJobOther = { id: 'fj-2', data: { scanId: 'other-scan' }, remove: jest.fn() };
      (freeScanQueue.getJobs as any).mockResolvedValue([mockFreeJob, mockFreeJobOther]);

      const mockEntJob = { id: 'ej-1', data: { scanId: 'scan-c1' }, remove: jest.fn().mockResolvedValue(true) };
      (enterpriseScanQueue.getJobs as any).mockResolvedValue([mockEntJob]);

      const result = await cancelScan('scan-c1');

      expect(mockScanUpdateMany).toHaveBeenCalledWith({
        where: {
          id: 'scan-c1',
          status: { in: ['pending', 'scanning'] },
        },
        data: expect.objectContaining({
          status: 'cancelled',
          errorMessage: null,
        }),
      });

      expect(freeScanQueue.getJobs).toHaveBeenCalledWith(['waiting', 'delayed']);
      expect(mockFreeJob.remove).toHaveBeenCalled();
      expect(mockFreeJobOther.remove).not.toHaveBeenCalled();

      expect(enterpriseScanQueue.getJobs).toHaveBeenCalledWith(['waiting', 'delayed']);
      expect(mockEntJob.remove).toHaveBeenCalled();

      expect(result).toEqual({ scanId: 'scan-c1', status: 'cancelled' });
    });

    it('should return null if scan was not cancellable', async () => {
      mockScanUpdateMany.mockResolvedValue({ count: 0 });

      const result = await cancelScan('scan-nonexistent');

      expect(result).toBeNull();
      expect(freeScanQueue.getJobs).not.toHaveBeenCalled();
    });
  });

  describe('getScanQueueStatus', () => {
    it('should return queue status for scan jobs', async () => {
      (freeScanQueue.getJobs as any).mockResolvedValue([
        { id: 'fj-s', data: { scanId: 'scan-status' }, getState: async () => 'active', progress: 50 },
      ]);
      (enterpriseScanQueue.getJobs as any).mockResolvedValue([]);

      const result = await getScanQueueStatus('scan-status');

      expect(freeScanQueue.getJobs).toHaveBeenCalledWith(['waiting', 'active', 'delayed']);
      expect(result).toEqual({
        scanId: 'scan-status',
        freeScanner: {
          jobId: 'fj-s',
          state: 'active',
          progress: 50,
        },
        enterpriseScanner: null,
      });
    });
  });
});
