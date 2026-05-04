import type { Prisma } from '@prisma/client';
import type { Scan } from "wasp/entities";
import { HttpError, prisma } from "wasp/server";
import { quotaService } from "./quotaService.js";
import { validateGitHubUrl } from "./inputAdapterService.js";
import { initializeWorkers } from "../queues/config.js";
import type { ScanJobInputType } from "../queues/jobContract.js";
import { startScanTimeoutSweeper } from "./scanTimeoutService.js";
import { orchestrateScan } from "../operations/scans/orchestrator.js";
import { shouldUseEmbeddedWorkers } from "../config/runtime.js";
import { getSnykScannerReadiness } from "./scannerReadinessService.js";
import { resolvePlannedScannerExecutions } from "../lib/scanners/providerSelection.js";
import type { PersistedGitHubScanContext } from './githubAppService';

export type ScanInputType = "github" | "sbom" | "source_zip";

export interface ScanSubmissionResult {
  scan: Scan;
  quotaRemaining: number;
}

interface SubmissionInput {
  userId: string;
  workspaceId: string;
  inputType: ScanInputType;
  inputRef: string;
  githubContext?: PersistedGitHubScanContext | null;
}

function internalInputTypeFor(inputType: ScanInputType): ScanJobInputType {
  switch (inputType) {
    case "github":
      return "github_app";
    case "sbom":
      return "sbom_upload";
    case "source_zip":
      return "source_zip";
  }
}

export async function submitScanSubmission(
  input: SubmissionInput,
): Promise<ScanSubmissionResult> {
  if (input.inputType === "github") {
    validateGitHubUrl(input.inputRef);
  }

  const planAtSubmission = await prisma.user.findUnique({
    where: { id: input.userId },
    select: { plan: true },
  }).then((user) => {
    if (!user) {
      throw new HttpError(404, "User not found");
    }
    return user.plan;
  });

  let createdScanId: string | null = null;
  let quotaRemaining = 0;
  const snykReadiness = await getSnykScannerReadiness(prisma, input.userId);
  const plannedExecutions = resolvePlannedScannerExecutions(planAtSubmission, {
    userId: input.userId,
    snykReadiness,
  });

  if (planAtSubmission === "enterprise" && snykReadiness.enabled && !snykReadiness.ready) {
    throw new HttpError(422, "Snyk scanner is enabled but not ready", {
      detail: snykReadiness.reason,
    });
  }

  await prisma.$transaction(async (tx) => {
    const scan = await tx.scan.create({
      data: {
        userId: input.userId,
        workspaceId: input.workspaceId,
        inputType: internalInputTypeFor(input.inputType),
        inputRef: input.inputRef,
        githubContext: input.githubContext as Prisma.InputJsonValue | undefined,
        status: "pending",
        planAtSubmission,
        plannedSources: plannedExecutions.map((execution) => execution.resultSource),
      },
    });
    createdScanId = scan.id;

    await tx.scanDelta.create({
      data: {
        scanId: scan.id,
        totalFreeCount: 0,
        totalEnterpriseCount: 0,
        deltaCount: 0,
        deltaBySeverity: {},
        isLocked: false,
      },
    });

    const quotaInfo = await quotaService.consumeQuota(input.userId, scan.id, tx as any);
    quotaRemaining = quotaInfo.remaining;
  });

  try {
    const latestQuota = await quotaService.getQuota(input.userId);
    await quotaService.publishPostConsumeSignals(input.userId, latestQuota);
  } catch (quotaSignalError) {
    console.error(
      `[scan-submission] Failed to publish quota signals for user ${input.userId}:`,
      quotaSignalError,
    );
  }

  if (!createdScanId) {
    throw new HttpError(500, "Unable to create scan");
  }

  try {
    if (shouldUseEmbeddedWorkers()) {
      await initializeWorkers();
    }
    startScanTimeoutSweeper();
    await orchestrateScan({
      scanId: createdScanId,
      userId: input.userId,
      inputType: internalInputTypeFor(input.inputType),
      inputRef: input.inputRef,
      planAtSubmission,
      plannedExecutions,
    });
  } catch (error) {
    await prisma.scan.update({
      where: { id: createdScanId },
      data: {
        status: "error",
        errorMessage: `Scan orchestration failed: ${error instanceof Error ? error.message : String(error)}`,
      },
    });

    await quotaService.refundQuota(input.userId, createdScanId, "scan_orchestration_failed");
    throw new HttpError(500, "Scan orchestration failed", {
      detail: error instanceof Error ? error.message : String(error),
    });
  }

  const scan = await prisma.scan.findUnique({
    where: { id: createdScanId },
  });
  if (!scan) {
    throw new HttpError(500, "Created scan not found");
  }

  return { scan, quotaRemaining };
}
