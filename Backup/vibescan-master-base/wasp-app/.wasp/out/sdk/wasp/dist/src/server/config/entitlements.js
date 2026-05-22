export const ENTITLEMENTS_BY_PLAN = {
    free_trial: {
        features: {
            comparison: true,
            comparison_delta: true,
            comparison_winner: false,
            webhooks: false,
            events: false,
            billing: false,
            remediation: true,
            scanners: true,
        },
        limits: {
            monthly_scans: 5,
            monthly_comparisons: 5,
            monthly_remediation_prompts: 10,
            remediation_prompts_per_finding: 1,
            webhook_destinations: 0,
        },
    },
    starter: {
        features: {
            comparison: true,
            comparison_delta: true,
            comparison_winner: true,
            webhooks: true,
            events: true,
            billing: true,
            remediation: true,
            scanners: true,
        },
        limits: {
            monthly_scans: 50,
            monthly_comparisons: 50,
            monthly_remediation_prompts: 100,
            remediation_prompts_per_finding: 3,
            webhook_destinations: 1,
        },
    },
    pro: {
        features: {
            comparison: true,
            comparison_delta: true,
            comparison_winner: true,
            webhooks: true,
            events: true,
            billing: true,
            remediation: true,
            scanners: true,
        },
        limits: {
            monthly_scans: 500,
            monthly_comparisons: 500,
            monthly_remediation_prompts: 500,
            remediation_prompts_per_finding: 10,
            webhook_destinations: 5,
        },
    },
    enterprise: {
        features: {
            comparison: true,
            comparison_delta: true,
            comparison_winner: true,
            webhooks: true,
            events: true,
            billing: true,
            remediation: true,
            scanners: true,
        },
        limits: {
            monthly_scans: null,
            monthly_comparisons: null,
            monthly_remediation_prompts: null,
            remediation_prompts_per_finding: null,
            webhook_destinations: null,
        },
    },
};
//# sourceMappingURL=entitlements.js.map