import { HttpError } from "wasp/server";
import * as z from "zod";
import { ensureArgsSchemaOrThrowHttpError } from "../server/validation";
import { submitScanSubmission } from "../server/services/scanSubmissionService";
import { buildWorkspaceOrLegacyOwnerWhere, requireWorkspaceScopedUser, } from "../server/services/workspaceAccess";
const submitScanInputSchema = z.object({
    inputRef: z.string().trim().min(1).max(512).describe("Repository/file reference"),
    inputType: z.enum(["github", "sbom", "source_zip"]).default("github"),
});
export const submitScan = async (rawArgs, context) => {
    const user = await requireWorkspaceScopedUser(context.user);
    const args = ensureArgsSchemaOrThrowHttpError(submitScanInputSchema, rawArgs);
    const result = await submitScanSubmission({
        userId: user.id,
        workspaceId: user.workspaceId,
        inputType: args.inputType,
        inputRef: args.inputRef,
    });
    return result.scan;
};
export const getScans = async (_args, context) => {
    const user = await requireWorkspaceScopedUser(context.user);
    return context.entities.Scan.findMany({
        where: buildWorkspaceOrLegacyOwnerWhere(user),
        orderBy: { createdAt: "desc" },
        take: 25,
    });
};
export const getScanById = async (args, context) => {
    const user = await requireWorkspaceScopedUser(context.user);
    const scanId = args.scanId?.trim();
    if (!scanId) {
        throw new HttpError(400, "Missing scan id.");
    }
    const scan = await context.entities.Scan.findFirst({
        where: {
            id: scanId,
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
    return scan;
};
//# sourceMappingURL=operations.js.map