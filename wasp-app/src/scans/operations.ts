import type { Scan, ScanDelta, ScanResult } from "wasp/entities";
import { HttpError } from "wasp/server";
import type { GetScanById, GetScans, SubmitScan } from "wasp/server/operations";
import * as z from "zod";
import { ensureArgsSchemaOrThrowHttpError } from "../server/validation";
import { submitScanSubmission } from "../server/services/scanSubmissionService";

const submitScanInputSchema = z.object({
  inputRef: z.string().trim().min(1).max(512).describe("Repository/file reference"),
  inputType: z.enum(["github", "sbom", "source_zip"]).default("github"),
});

type SubmitScanInput = z.infer<typeof submitScanInputSchema>;
type GetScanByIdInput = { scanId: string };

export type ScanWithDetails = Scan & {
  scanResults: ScanResult[];
  scanDeltas: ScanDelta[];
};

export const submitScan: SubmitScan<SubmitScanInput, Scan> = async (
  rawArgs,
  context,
) => {
  if (!context.user) {
    throw new HttpError(401);
  }

  const args = ensureArgsSchemaOrThrowHttpError(submitScanInputSchema, rawArgs);
  const result = await submitScanSubmission({
    userId: context.user.id,
    inputType: args.inputType,
    inputRef: args.inputRef,
  });

  return result.scan;
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

export const getScanById: GetScanById<GetScanByIdInput, ScanWithDetails> = async (
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
    include: {
      scanResults: true,
      scanDeltas: true,
    },
  });

  if (!scan) {
    throw new HttpError(404, "Scan not found.");
  }

  return scan;
};
