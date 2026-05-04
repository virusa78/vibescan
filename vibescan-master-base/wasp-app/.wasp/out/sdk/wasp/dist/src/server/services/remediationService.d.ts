import { type RemediationDraft, type RemediationPromptType } from '../../shared/remediation.js';
export interface GenerateCveRemediationInput {
    userId: string;
    scanId: string;
    findingId: string;
    requestKey: string;
    promptType?: string;
}
export interface GenerateCveRemediationResponse {
    [key: string]: unknown;
    usageId: string;
    aiFixPromptId: string;
    scanId: string;
    findingId: string;
    requestKey: string;
    promptType: RemediationPromptType;
    provider: 'local' | 'openai';
    modelName: string;
    quotaRemaining: number;
    promptText: string;
    responsePayload: RemediationDraft['responsePayload'];
}
export declare function generateCveRemediation(input: GenerateCveRemediationInput): Promise<GenerateCveRemediationResponse>;
//# sourceMappingURL=remediationService.d.ts.map