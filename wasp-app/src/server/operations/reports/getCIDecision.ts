import { HttpError, prisma } from "wasp/server";
import * as z from "zod";
import { ensureArgsSchemaOrThrowHttpError } from "../../validation";
import { requireWorkspaceScopedUser } from "../../services/workspaceAccess";
import { serializeDecimalFields } from "../../utils/serialization";
import { buildCiDecisionForScan, type CiDecisionResult } from "../../services/ciDecisionService";

const schema = z.object({ scanId: z.string().nonempty() });

type QueryContext = {
  user?: {
    id: string;
    workspaceId?: string | null;
  } | null;
};

export const getCIDecision = async (
  rawArgs: unknown,
  context: QueryContext,
): Promise<CiDecisionResult> => {
  const { scanId } = ensureArgsSchemaOrThrowHttpError(schema, rawArgs);

  const user = await requireWorkspaceScopedUser(context.user);

  const scan = await prisma.scan.findUnique({
    where: { id: scanId },
  });

  if (!scan) throw new HttpError(404, "Scan not found");
  if (!(scan.workspaceId === user.workspaceId || (!scan.workspaceId && scan.userId === user.id))) {
    throw new HttpError(404, "Scan not found");
  }

  const decision = await buildCiDecisionForScan(prisma, scanId);

  return serializeDecimalFields(decision) as CiDecisionResult;
};
