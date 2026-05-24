import type { Scan } from "wasp/entities";
import { HttpError } from "wasp/server";
import type { GetScanById, GetScans, SubmitScan } from "wasp/server/operations";
import * as z from "zod";
import { ensureArgsSchemaOrThrowHttpError } from "../server/validation";
import { submitScanSubmission } from "../server/services/scanSubmissionService";
import {
  buildWorkspaceOrLegacyOwnerWhere,
  requireWorkspaceScopedUser,
} from "../server/services/workspaceAccess";
import { serializeDecimalFields } from "../server/utils/serialization";

const submitScanInputSchema = z.object({
  inputRef: z.string().trim().min(1).max(512).describe("Repository/file reference"),
  inputType: z.enum(["github", "sbom", "source_zip"]).default("github"),
  selectedSources: z.array(z.enum(["grype", "trivy", "codescoring_johnny", "owasp", "snyk"])).optional(),
});

const getScanByIdSchema = z.object({
  scanId: z.string().trim().uuid("Invalid scan ID format"),
});

type SubmitScanInput = z.infer<typeof submitScanInputSchema>;
type GetScanByIdInput = z.infer<typeof getScanByIdSchema>;

export type ScanWithDetails = Scan & {
  scanResults: Array<Record<string, any>>;
  scanDeltas: Array<Record<string, any>>;
};

export const submitScan: SubmitScan<SubmitScanInput, Scan> = async (
  rawArgs,
  context,
) => {
  const user = await requireWorkspaceScopedUser(context.user as any);

  const args = ensureArgsSchemaOrThrowHttpError(submitScanInputSchema, rawArgs);
  const result = await submitScanSubmission({
    userId: user.id,
    workspaceId: user.workspaceId,
    inputType: args.inputType,
    inputRef: args.inputRef,
    selectedSources: args.selectedSources,
  });

  return result.scan;
};

export const getScans: GetScans<void, Scan[]> = async (_args, context) => {
  const user = await requireWorkspaceScopedUser(context.user as any);

  const scans = await context.entities.Scan.findMany({
    where: buildWorkspaceOrLegacyOwnerWhere(user),
    orderBy: { createdAt: "desc" },
    take: 25,
  });

  return scans.map(serializeDecimalFields);
};

export const getScanById: GetScanById<GetScanByIdInput, ScanWithDetails> = async (
  rawArgs,
  context,
) => {
  const user = await requireWorkspaceScopedUser(context.user as any);

  const args = ensureArgsSchemaOrThrowHttpError(getScanByIdSchema, rawArgs);

  const scan = await context.entities.Scan.findFirst({
    where: {
      id: args.scanId,
      ...buildWorkspaceOrLegacyOwnerWhere(user),
    },
    include: {
      scanResults: true,
      scanDeltas: true,
    },
  });

  if (!scan) {
    throw new HttpError(404, "Scan not found.");
  }

  return serializeDecimalFields(scan);
};
