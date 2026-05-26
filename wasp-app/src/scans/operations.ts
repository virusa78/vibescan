import type { Scan } from "wasp/entities";
import { HttpError } from "wasp/server";
import type { GetScanById, GetScans, SubmitScan, UploadScanFile } from "wasp/server/operations";
import * as z from "zod";
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";
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
  // Allow both UUIDs and legacy string IDs (e.g., 'scan-1') used in tests
  scanId: z.string().trim().min(1).max(200).describe('Scan ID'),
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

const uploadScanFileInputSchema = z.object({
  fileName: z.string().trim().min(1).max(255),
  fileContent: z.string().describe("Base64 encoded file content"),
});

type UploadScanFileInput = z.infer<typeof uploadScanFileInputSchema>;

export const uploadScanFile: UploadScanFile<UploadScanFileInput, { uniqueName: string }> = async (
  rawArgs,
  context,
) => {
  const user = await requireWorkspaceScopedUser(context.user as any);

  const args = ensureArgsSchemaOrThrowHttpError(uploadScanFileInputSchema, rawArgs);

  const runtimeTempRoot = process.env.VIBESCAN_RUNTIME_TMP_DIR
    ?? join(process.cwd(), 'test-results', 'runtime-temp');
  const defaultTrustedScanInputRoot = join(runtimeTempRoot, 'scan-inputs');
  const rootDir = process.env.VIBESCAN_SCAN_INPUT_DIR ?? defaultTrustedScanInputRoot;

  // Ensure directory exists
  mkdirSync(rootDir, { recursive: true });

  // Generate a unique safe filename
  const cleanFileName = args.fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  const uniqueName = `upload-${Date.now()}-${cleanFileName}`;
  const targetPath = join(rootDir, uniqueName);

  // Convert base64 back to buffer and write
  const buffer = Buffer.from(args.fileContent, 'base64');
  
  // Write to file
  writeFileSync(targetPath, buffer);

  return {
    uniqueName,
  };
};
