import { type User, type Scan, type Finding } from "wasp/entities";
import { HttpError, prisma } from "wasp/server";
import * as z from "zod";
import { ensureArgsSchemaOrThrowHttpError } from "../../validation";

const getReportInputSchema = z.object({
  scanId: z.string().nonempty(),
});

export type GetReportInput = z.infer<typeof getReportInputSchema>;

export const getReport = async (rawArgs: any, context: any) => {
  const { scanId } = ensureArgsSchemaOrThrowHttpError(
    getReportInputSchema,
    rawArgs
  );

  if (!context.user) {
    throw new HttpError(401, "Authentication required");
  }

  const scan = await prisma.scan.findUnique({
    where: { id: scanId },
    include: { findings: true },
  });

  if (!scan) {
    throw new HttpError(404, "Scan not found");
  }

  if (scan.userId !== context.user.id) {
    throw new HttpError(403, "Unauthorized");
  }

  return { scanId, findings: scan.findings || [] };
};
