export type RemediationPromptType = 'quick_fix' | 'patch' | 'verification';
export interface FindingRemediationContext {
    id: string;
    cveId: string;
    packageName: string;
    installedVersion: string;
    filePath?: string | null;
    severity: string;
    description?: string | null;
    cvssScore?: number | null;
}
export interface RemediationPolicyContext {
    regionCode: string;
    monthlyRemediationPromptLimit: number;
    maxPromptsPerFinding: number;
}
export interface RemediationPromptRequest {
    finding: FindingRemediationContext;
    promptType: RemediationPromptType;
    policy: RemediationPolicyContext;
    requestKey: string;
}
export interface RemediationGuidance {
    summary: string;
    riskNotes: string[];
    patchGuidance: string[];
    verificationChecklist: string[];
}
export interface RemediationDraft {
    provider: 'local' | 'openai';
    modelName: string;
    promptText: string;
    responsePayload: RemediationGuidance & {
        promptType: RemediationPromptType;
        requestKey: string;
        findingId: string;
        policy: RemediationPolicyContext;
    };
}
export declare function normalizeRemediationPromptType(value?: string | null): RemediationPromptType;
export declare function buildRemediationPromptText(request: RemediationPromptRequest): string;
export declare function buildLocalRemediationDraft(request: RemediationPromptRequest): RemediationDraft;
//# sourceMappingURL=remediation.d.ts.map