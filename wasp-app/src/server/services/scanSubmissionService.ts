import type { Scan } from "wasp/entities";
import { HttpError, prisma } from "wasp/server";
import { quotaService } from "./quotaService.js";
import { validateGitHubUrl } from "./inputAdapterService.js";
import { initializeWorkers } from "../queues/config.js";
import { startScanTimeoutSweeper } from "./scanTimeoutService.js";
import { orchestrateScan } from "../operations/scans/orchestrator.js";

export type ScanInputType = "github" | "sbom" | "source_zip";

export interface ScanSubmissionResult {
  scan: Scan;
  quotaRemaining: number;
}

interface SubmissionInput {
  userId: string;
  inputType: ScanInputType;
  inputRef: string;
}

function internalInputTypeFor(inputType: ScanInputType): "github_app" | "sbom_upload" | "source_zip" {
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

  await prisma.$transaction(async (tx) => {
    const scan = await tx.scan.create({
      data: {
        userId: input.userId,
        inputType: internalInputTypeFor(input.inputType),
        inputRef: input.inputRef,
        status: "pending",
        planAtSubmission,
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

    const quotaInfo = await quotaService.consumeQuota(input.userId, scan.id, tx);
    quotaRemaining = quotaInfo.remaining;
  });

  if (!createdScanId) {
    throw new HttpError(500, "Unable to create scan");
  }

  try {
    await initializeWorkers();
    startScanTimeoutSweeper();
    await orchestrateScan({
      scanId: createdScanId,
      userId: input.userId,
      inputType: internalInputTypeFor(input.inputType),
      inputRef: input.inputRef,
      planAtSubmission,
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
