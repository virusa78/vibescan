export type GithubAppSetupResponse = {
    configured: boolean;
    app_id: string | null;
    app_slug: string | null;
    install_url: string | null;
    callback_url: string | null;
    webhook_url: string | null;
    manual_linking_required: boolean;
};
export declare function getGithubAppSetup(): Promise<any>;
//# sourceMappingURL=getGithubAppSetup.d.ts.map