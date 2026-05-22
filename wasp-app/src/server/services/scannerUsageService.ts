import type { PrismaClient } from '@prisma/client';
import { HttpError } from 'wasp/server';
import type { PlannedScannerExecution } from '../lib/scanners/providerSelection.js';
import { getScannerMonthlyLimit, isUnlimitedScannerMonthlyLimit } from '../config/scannerPolicy.js';

export type ScannerUsagePrismaClient = Pick<PrismaClient, 'scannerUsageLedger'>;

function getCurrentPeriodKey(date = new Date()): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

function getScannerLimitError(provider: string, planTier: string, limit: number, used: number): HttpError {
  return new HttpError(429, 'Scanner monthly limit exceeded', {
    detail: `${provider} is limited to ${limit} runs per month on ${planTier}; used ${used}.`,
    provider,
    planTier,
    limit,
    used,
  });
}

export async function reserveScannerMonthlyUsage(
  prisma: ScannerUsagePrismaClient,
  input: {
    userId: string;
    workspaceId: string;
    scanId: string;
    planTier: string;
    plannedExecutions: PlannedScannerExecution[];
    periodKey?: string;
  },
): Promise<void> {
  const periodKey = input.periodKey ?? getCurrentPeriodKey();

  for (const execution of input.plannedExecutions) {
    const limit = getScannerMonthlyLimit(input.planTier, execution.provider);
    if (isUnlimitedScannerMonthlyLimit(limit)) {
      continue;
    }

    const used = await prisma.scannerUsageLedger.count({
      where: {
        userId: input.userId,
        provider: execution.provider,
        periodKey,
      },
    });

    if (used >= limit) {
      throw getScannerLimitError(execution.provider, input.planTier, limit, used);
    }

    await prisma.scannerUsageLedger.create({
      data: {
        userId: input.userId,
        workspaceId: input.workspaceId,
        scanId: input.scanId,
        provider: execution.provider,
        planTier: input.planTier,
        periodKey,
        limitApplied: limit,
      },
    });
  }
}

export function getScannerUsagePeriodKey(date = new Date()): string {
  return getCurrentPeriodKey(date);
}
