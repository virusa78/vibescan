import { HttpError, prisma } from "wasp/server";
import * as z from "zod";
import { ensureArgsSchemaOrThrowHttpError } from "../../validation";
import { requireWorkspaceScopedUser } from "../../services/workspaceAccess";
const schema = z.object({ scanId: z.string().nonempty() });
export const generateReportPDF = async (rawArgs, context) => {
    const { scanId } = ensureArgsSchemaOrThrowHttpError(schema, rawArgs);
    const user = await requireWorkspaceScopedUser(context.user);
    const scan = await prisma.scan.findUnique({ where: { id: scanId } });
    if (!scan)
        throw new HttpError(404, "Scan not found");
    if (!(scan.workspaceId === user.workspaceId || (!scan.workspaceId && scan.userId === user.id))) {
        throw new HttpError(404, "Scan not found");
    }
    const jobId = `pdf-${scanId}-${Date.now()}`;
    return { scanId, jobId, status: "queued", estimatedTime: "~30 seconds" };
};
//# sourceMappingURL=generateReportPDF.js.map