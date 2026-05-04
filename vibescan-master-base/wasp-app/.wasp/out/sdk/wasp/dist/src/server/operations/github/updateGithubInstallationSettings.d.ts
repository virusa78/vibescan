import * as z from 'zod';
declare const updateGithubInstallationSettingsInputSchema: z.ZodObject<{
    installationId: z.ZodString;
    repos_scope: z.ZodArray<z.ZodString>;
    trigger_on_push: z.ZodBoolean;
    trigger_on_pr: z.ZodBoolean;
    target_branches: z.ZodArray<z.ZodString>;
    fail_pr_on_severity: z.ZodEnum<{
        CRITICAL: "CRITICAL";
        HIGH: "HIGH";
        MEDIUM: "MEDIUM";
        LOW: "LOW";
    }>;
}, z.core.$strip>;
export type UpdateGithubInstallationSettingsInput = z.infer<typeof updateGithubInstallationSettingsInputSchema>;
export type UpdateGithubInstallationSettingsResponse = {
    id: string;
    github_installation_id: string;
    workspace_id: string | null;
    org_id: string | null;
    account_login: string | null;
    repository_selection: string;
    repos_scope: string[];
    trigger_on_push: boolean;
    trigger_on_pr: boolean;
    target_branches: string[];
    fail_pr_on_severity: string;
    available_repos: string[];
};
export declare function updateGithubInstallationSettings(rawArgs: unknown, context: any): Promise<any>;
export {};
//# sourceMappingURL=updateGithubInstallationSettings.d.ts.map