export type CiVisibilityScope = 'free' | 'merged';

export type ReportAccessPolicy = {
    locked: boolean;
    includeEnterpriseDetails: boolean;
    includeDeltaDetails: boolean;
    ciVisibilityScope: CiVisibilityScope;
};

export function getReportAccessPolicy(planAtSubmission: string): ReportAccessPolicy {
    const locked = planAtSubmission === 'starter';
    return {
        locked,
        includeEnterpriseDetails: !locked,
        includeDeltaDetails: !locked,
        ciVisibilityScope: locked ? 'free' : 'merged'
    };
}
