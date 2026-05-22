import * as z from "zod";
export declare function getClientEnvSchema(mode: string): z.ZodObject<{
    REACT_APP_API_URL: z.ZodDefault<z.ZodPipe<z.ZodString, z.ZodURL>>;
} | {
    REACT_APP_API_URL: z.ZodPipe<z.ZodString, z.ZodURL>;
}, z.core.$strip>;
//# sourceMappingURL=schema.d.ts.map