export type WebhookTargetValidationOptions = {
    allowHttp?: boolean;
    allowLocalHttp?: boolean;
    lookup?: (hostname: string, options: {
        all: true;
    }) => Promise<Array<{
        address: string;
        family: number;
    }>>;
};
export declare function validateWebhookTargetUrl(value: string, options?: WebhookTargetValidationOptions): Promise<URL>;
//# sourceMappingURL=webhookTarget.d.ts.map