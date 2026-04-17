import { HttpError, prisma } from "wasp/server";
import * as z from "zod";
import { ensureArgsSchemaOrThrowHttpError } from "../../validation";

const schema = z.object({ scanId: z.string().nonempty() });

export const getCIDecision = async (rawArgs: any, context: any) => {
  const { scanId } = ensureArgsSchemaOrThrowHttpError(schema, rawArgs);

  if (!context.user) throw new HttpError(401, "Authentication required");

  const scan = await prisma.scan.findUnique({
    where: { id: scanId },
    include: { findings: true },
  });

  if (!scan) throw new HttpError(404, "Scan not found");
  if (scan.userId !== context.user.id) throw new HttpError(403, "Unauthorized");

  const findings = scan.findings || [];
  const criticalIssues = findings.filter((f: any) => f.severity === "critical").length;

  return {
    scanId,
    decision: criticalIssues === 0 ? "pass" : "fail",
    reason: criticalIssues === 0 ? "No critical vulnerabilities" : `${criticalIssues} critical vulnerabilities`,
    criticalIssues,
  };
};
