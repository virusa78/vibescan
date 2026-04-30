import { HttpError, prisma } from "wasp/server";
import * as z from "zod";
import { ensureArgsSchemaOrThrowHttpError } from "../../validation";

const schema = z.object({ scanId: z.string().nonempty() });

export const getReportSummary = async (rawArgs: any, context: any): Promise<any> => {
  const { scanId } = ensureArgsSchemaOrThrowHttpError(schema, rawArgs);

  if (!context.user) throw new HttpError(401, "Authentication required");

  const scan = await prisma.scan.findUnique({
    where: { id: scanId },
    include: { findings: true },
  });

  if (!scan) throw new HttpError(404, "Scan not found");
  if (scan.userId !== context.user.id) throw new HttpError(403, "Unauthorized");

  const findings = scan.findings || [];
  return {
    scanId,
    totalFindings: findings.length,
    severity: {
      critical: findings.filter((f: any) => f.severity === "critical").length,
      high: findings.filter((f: any) => f.severity === "high").length,
    },
  } as any;
};
