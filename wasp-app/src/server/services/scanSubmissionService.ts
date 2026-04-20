import type { Scan } from "wasp/entities";
import { HttpError, prisma } from "wasp/server";
import type { Prisma } from "@prisma/client";
import { readFileSync } from "fs";
import { quotaService } from "./quotaService.js";
import {
  buildCycloneDxSbom,
  cloneGitHubAndScanWithSyft,
  extractZipAndScanWithSyft,
  normalizeComponents,
  validateAndExtractSBOM,
  validateGitHubUrl,
  type NormalizedComponent,
} from "./inputAdapterService.js";
import { initializeWorkers } from "../queues/config.js";
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
  sbomContent?: string;
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

async function resolveComponentsAndSbom(
  input: SubmissionInput,
): Promise<{ components: NormalizedComponent[]; sbomRaw: Prisma.InputJsonValue }> {
  if (input.inputType === "github") {
    validateGitHubUrl(input.inputRef);
    const components = await cloneGitHubAndScanWithSyft(input.inputRef);
    return {
      components: await normalizeComponents(components),
      sbomRaw: buildCycloneDxSbom(components) as Prisma.InputJsonValue,
    };
  }

  if (input.inputType === "sbom") {
    const rawText =
      input.sbomContent?.trim() ||
      readFileSync(input.inputRef, "utf8").trim();
    const sbomResult = validateAndExtractSBOM(rawText);
    return {
      components: await normalizeComponents(sbomResult.components),
      sbomRaw: JSON.parse(rawText) as Prisma.InputJsonValue,
    };
  }

  const components = await extractZipAndScanWithSyft(input.inputRef);
  return {
    components,
    sbomRaw: buildCycloneDxSbom(components) as Prisma.InputJsonValue,
  };
}

export async function submitScanSubmission(
  input: SubmissionInput,
): Promise<ScanSubmissionResult> {
  const { components, sbomRaw } = await resolveComponentsAndSbom(input);
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
        components: components as unknown as Prisma.InputJsonValue,
        sbomRaw,
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
        isLocked: planAtSubmission === "free_trial" || planAtSubmission === "starter",
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
