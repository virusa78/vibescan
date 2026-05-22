import * as z from 'zod';
declare const switchWorkspaceInputSchema: z.ZodObject<{
    workspace_id: z.ZodString;
}, z.core.$strip>;
export type SwitchWorkspaceInput = z.infer<typeof switchWorkspaceInputSchema>;
export declare function switchWorkspace(rawArgs: unknown, context: any): Promise<any>;
export {};
//# sourceMappingURL=switchWorkspace.d.ts.map