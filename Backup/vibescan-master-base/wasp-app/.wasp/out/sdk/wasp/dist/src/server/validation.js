import { HttpError } from "wasp/server";
function formatZodError(error) {
    return error.issues
        .map((issue) => {
        const path = issue.path.length > 0 ? issue.path.join(".") : "<root>";
        return `${path}: ${issue.message}`;
    })
        .join("\n");
}
export function ensureArgsSchemaOrThrowHttpError(schema, rawArgs) {
    const parseResult = schema.safeParse(rawArgs);
    if (!parseResult.success) {
        console.error(
        // We keep the `cause` property so that errors have stack traces pointing
        // to the original schema.
        new Error("Operation arguments validation failed:\n" +
            formatZodError(parseResult.error), { cause: parseResult.error }));
        throw new HttpError(400, "Operation arguments validation failed", {
            cause: parseResult.error,
        });
    }
    else {
        return parseResult.data;
    }
}
//# sourceMappingURL=validation.js.map