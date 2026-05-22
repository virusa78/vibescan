export type OnboardingStateResponse = {
    should_show_onboarding: boolean;
    is_complete: boolean;
    has_workspace: boolean;
    has_scans: boolean;
    has_github_installation: boolean;
    workspace_name: string | null;
    workspace_slug: string | null;
    recommended_path: 'github' | 'manual';
    primary_cta_route: string;
    secondary_cta_route: string | null;
};
export declare function getOnboardingState(_rawArgs: unknown, context: any): Promise<any>;
//# sourceMappingURL=getOnboardingState.d.ts.map