import { prisma } from 'wasp/server';
import { cancelScan as cancelScanJobs } from '../operations/scans/orchestrator.js';
import { quotaService } from './quotaService.js';
import { getScanSweepIntervalMs, getScanTimeoutMs } from './scanTimeoutPolicy.js';

let sweepTimer: ReturnType<typeof setInterval> | null = null;
let sweepRunning = false;

async function cancelExpiredScan(scanId: string, userId: string, timeoutMs: number): Promise<boolean> {
  const cancelled = await cancelScanJobs(scanId, `Scan timed out after ${timeoutMs}ms`);
  if (!cancelled) {
    return false;
  }

  await quotaService.refundQuota(userId, scanId, 'scan_timeout');
  return true;
}

export async function sweepExpiredScans(now: Date = new Date()): Promise<number> {
  if (sweepRunning) {
    return 0;
  }

  sweepRunning = true;

  try {
    const timeoutMs = getScanTimeoutMs();
    const cutoff = new Date(now.getTime() - timeoutMs);

    const staleScans = await prisma.scan.findMany({
      where: {
        status: {
          in: ['pending', 'scanning'],
        },
        createdAt: {
          lt: cutoff,
        },
      },
      select: {
        id: true,
        userId: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
      take: 100,
    });

    let cancelledCount = 0;
    for (const scan of staleScans) {
      const cancelled = await cancelExpiredScan(scan.id, scan.userId, timeoutMs);
      if (cancelled) {
        cancelledCount += 1;
      }
    }

    if (cancelledCount > 0) {
      console.log(
        `[ScanTimeout] Cancelled ${cancelledCount} stale scan(s) older than ${timeoutMs}ms`,
      );
    }

    return cancelledCount;
  } finally {
    sweepRunning = false;
  }
}

export function startScanTimeoutSweeper(): void {
  if (sweepTimer) {
    return;
  }

  sweepTimer = setInterval(() => {
    void sweepExpiredScans().catch((error) => {
      console.error('[ScanTimeout] Sweep failed:', error);
    });
  }, getScanSweepIntervalMs());

  sweepTimer.unref?.();
  void sweepExpiredScans().catch((error) => {
    console.error('[ScanTimeout] Initial sweep failed:', error);
  });
}

export async function stopScanTimeoutSweeper(): Promise<void> {
  if (!sweepTimer) {
    return;
  }

  clearInterval(sweepTimer);
  sweepTimer = null;
}
