import type { Scan } from "wasp/entities";
import { HttpError } from "wasp/server";
import type { GetScanById, GetScans, SubmitScan } from "wasp/server/operations";
import * as z from "zod";
import { ensureArgsSchemaOrThrowHttpError } from "../server/validation";

const submitScanInputSchema = z.object({
  githubRepo: z.string().trim().min(3).max(255),
  githubRef: z.string().trim().min(1).max(120).default("main"),
  githubToken: z.string().trim().max(255).optional(),
  isPrivateRepo: z.boolean().optional(),
});

type SubmitScanInput = z.infer<typeof submitScanInputSchema>;
type GetScanByIdInput = { scanId: string };

export const submitScan: SubmitScan<SubmitScanInput, Scan> = async (
  rawArgs,
  context,
) => {
  if (!context.user) {
    throw new HttpError(401);
  }

  const args = ensureArgsSchemaOrThrowHttpError(submitScanInputSchema, rawArgs);
  const githubToken = args.githubToken?.trim();
  const isPrivateRepo = args.isPrivateRepo ?? true;

  if (isPrivateRepo && !githubToken) {
    throw new HttpError(
      400,
      "Private repositories require a GitHub token in settings or submission.",
    );
  }

  return context.entities.Scan.create({
    data: {
      user: { connect: { id: context.user.id } },
      inputType: "github",
      status: "queued",
      githubRepo: args.githubRepo,
      githubRef: args.githubRef,
    },
  });
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
