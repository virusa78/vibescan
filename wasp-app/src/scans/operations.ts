import type { Scan } from "wasp/entities";
import { HttpError } from "wasp/server";
import type { GetScanById, GetScans, SubmitScan } from "wasp/server/operations";
import * as z from "zod";
import { ensureArgsSchemaOrThrowHttpError } from "../server/validation";
import { computeReimportDelta, computeFingerprint, type NormalizedFinding } from "./reimportLogic";

const submitScanInputSchema = z.object({
  inputRef: z.string().trim().min(1).max(255).describe("Repository/file reference"),
  inputType: z.enum(["github", "sbom", "source_zip"]).default("github"),
});

type SubmitScanInput = z.infer<typeof submitScanInputSchema>;
type GetScanByIdInput = { scanId: string };

/**
 * Mock scanner output — replace with real worker integration
 */
function generateMockScannerOutput(_inputRef: string): NormalizedFinding[] {
  // For now, return mock findings for testing
  return [
    {
      cveId: "CVE-2024-1234",
      packageName: "lodash",
      installedVersion: "4.17.20",
      filePath: "node_modules/lodash/index.js",
      severity: "high",
      cvssScore: 7.5,
      fixedVersion: "4.17.21",
      description: "Prototype pollution in lodash",
      source: "free" as any,
      detectedData: {},
    },
    {
      cveId: "CVE-2024-5678",
      packageName: "express",
      installedVersion: "4.18.0",
      filePath: "node_modules/express/index.js",
      severity: "medium",
      cvssScore: 5.3,
      fixedVersion: "4.18.1",
      description: "DoS in express middleware",
      source: "free" as any,
      detectedData: {},
    },
  ];
}

export const submitScan: SubmitScan<SubmitScanInput, Scan> = async (
  rawArgs,
  context,
) => {
  if (!context.user) {
    throw new HttpError(401);
  }

  const args = ensureArgsSchemaOrThrowHttpError(submitScanInputSchema, rawArgs);

  // 1. Find previous scan by inputRef (for re-import deduplication)
  const previousScan = await context.entities.Scan.findFirst({
    where: {
      userId: context.user.id,
      inputRef: args.inputRef,
      status: "done",
    },
    orderBy: { createdAt: "desc" },
  });

  // If previous scan exists, load its findings separately
  let previousFindings: any[] = [];
  if (previousScan) {
    previousFindings = await context.entities.Finding.findMany({
      where: {
        scanId: previousScan.id,
      },
    });
  }

  // 2. Create new scan
  const newScan = await context.entities.Scan.create({
    data: {
      user: { connect: { id: context.user.id } },
      inputType: args.inputType,
      inputRef: args.inputRef,
      status: "pending",
      components: [],
      sbomRaw: undefined,
    },
  });

  // 3. Create ScanDelta record
  let scanDelta = await context.entities.ScanDelta.findUnique({
    where: { scanId: newScan.id },
  });

  if (!scanDelta) {
    scanDelta = await context.entities.ScanDelta.create({
      data: {
        scanId: newScan.id,
        totalFreeCount: 0,
        totalEnterpriseCount: 0,
        deltaCount: 0,
        deltaBySeverity: {},
        isLocked: false,
      },
    });
  }

  // 4. Get new findings from mock scanners (replace with real workers)
  const newFindings = generateMockScannerOutput(args.inputRef);

  let newCount = 0;
  let mitigatedCount = 0;
  let updatedCount = 0;
  let unchangedCount = 0;

  // 5. If previous scan exists, deduplicate findings
  if (previousScan && previousFindings.length > 0) {
    // Convert DB findings to NormalizedFinding format
    const oldFindings = previousFindings.map(f => ({
      cveId: f.cveId,
      packageName: f.packageName,
      installedVersion: f.installedVersion,
      filePath: f.filePath || undefined,
      severity: f.severity,
      cvssScore: f.cvssScore || undefined,
      fixedVersion: f.fixedVersion || undefined,
      description: f.description || undefined,
      source: f.source,
      detectedData: f.detectedData || {},
    } as NormalizedFinding));

    // Compute delta
    const reimportDelta = computeReimportDelta(oldFindings, newFindings);

    newCount = reimportDelta.new.length;
    mitigatedCount = reimportDelta.mitigated.length;
    updatedCount = reimportDelta.updated.length;
    unchangedCount = reimportDelta.unchanged.length;

    // 5a. Create new findings
    for (const finding of reimportDelta.new) {
      const fingerprint = computeFingerprint(finding);
      await context.entities.Finding.create({
        data: {
          scanId: newScan.id,
          userId: context.user.id,
          fingerprint,
          cveId: finding.cveId,
          packageName: finding.packageName,
          installedVersion: finding.installedVersion,
          filePath: finding.filePath,
          severity: finding.severity,
          cvssScore: finding.cvssScore,
          fixedVersion: finding.fixedVersion,
          description: finding.description,
          source: finding.source,
          detectedData: finding.detectedData,
          status: "active",
        },
      });
    }

    // 5b. Update existing findings for severity/fix changes
    for (const change of reimportDelta.updated) {
      // Find the most recent finding with this CVE
      const existingFinding = await context.entities.Finding.findFirst({
        where: {
          cveId: change.findingId,
          scanId: previousScan.id,
        },
      });

      if (existingFinding) {
        await context.entities.Finding.update({
          where: { id: existingFinding.id },
          data: {
            severity: change.newSeverity,
            fixedVersion: change.newFixVersion,
          },
        });

        // Log history
        await context.entities.FindingHistory.create({
          data: {
            findingId: existingFinding.id,
            event: "severity_changed",
            prevValue: change.prevSeverity,
            newValue: change.newSeverity,
            metadata: {
              prevFixVersion: change.prevFixVersion,
              newFixVersion: change.newFixVersion,
            },
          },
        });
      }
    }

    // 5c. Mark mitigated findings
    for (const item of reimportDelta.mitigated) {
      const existingFinding = await context.entities.Finding.findFirst({
        where: {
          cveId: item.findingId,
          scanId: previousScan.id,
          status: "active",
        },
      });

      if (existingFinding) {
        await context.entities.Finding.update({
          where: { id: existingFinding.id },
          data: {
            status: "mitigated",
            mitigatedAt: item.mitigatedAt,
            mitigatedInScanId: newScan.id,
          },
        });

        // Log history
        await context.entities.FindingHistory.create({
          data: {
            findingId: existingFinding.id,
            event: "auto_mitigated",
            metadata: {
              mitigatedInScanId: newScan.id,
            },
          },
        });
      }
    }
  } else {
    // First scan — create all findings as new
    newCount = newFindings.length;

    for (const finding of newFindings) {
      const fingerprint = computeFingerprint(finding);
      await context.entities.Finding.create({
        data: {
          scanId: newScan.id,
          userId: context.user.id,
          fingerprint,
          cveId: finding.cveId,
          packageName: finding.packageName,
          installedVersion: finding.installedVersion,
          filePath: finding.filePath,
          severity: finding.severity,
          cvssScore: finding.cvssScore,
          fixedVersion: finding.fixedVersion,
          description: finding.description,
          source: finding.source,
          detectedData: finding.detectedData,
          status: "active",
        },
      });
    }
  }

  // 6. Update delta summary
  await context.entities.ScanDelta.update({
    where: { id: scanDelta.id },
    data: {
      totalFreeCount: newCount,
      totalEnterpriseCount: 0,
      deltaCount: newCount,
      reimportSummary: {
        new_count: newCount,
        mitigated_count: mitigatedCount,
        updated_count: updatedCount,
        unchanged_count: unchangedCount,
      },
    },
  });

  // Return updated scan
  return newScan;
};

export const getScans: GetScans<void, Scan[]> = async (_args, context) => {
  if (!context.user) {
    throw new HttpError(401);
  }

  return context.entities.Scan.findMany({
    where: { userId: context.user.id },
    orderBy: { createdAt: "desc" },
    take: 25,
  });
};

export const getScanById: GetScanById<GetScanByIdInput, Scan> = async (
  args,
  context,
) => {
  if (!context.user) {
    throw new HttpError(401);
  }

  const scanId = args.scanId?.trim();
  if (!scanId) {
    throw new HttpError(400, "Missing scan id.");
  }

  const scan = await context.entities.Scan.findFirst({
    where: {
      id: scanId,
      userId: context.user.id,
    },
  });

  if (!scan) {
    throw new HttpError(404, "Scan not found.");
  }

  return scan;
};
