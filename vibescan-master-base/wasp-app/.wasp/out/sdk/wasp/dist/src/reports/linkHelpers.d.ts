/**
 * External link generation helpers for report findings
 */
type Finding = {
    cveId?: string;
    cve?: string;
    packageName?: string;
    ecosystem?: string;
    fixedVersion?: string | null;
    severity?: string;
    [key: string]: unknown;
};
/**
 * Resolve CVE ID from finding data
 * Checks cveId field first, falls back to cve field
 */
export declare function resolveCveId(finding: Finding): string;
/**
 * Build GitHub Advisory search URL for a CVE
 */
export declare function buildGitHubAdvisoryUrl(cveId: string): string;
/**
 * Build NVD (National Vulnerability Database) detail URL for a CVE
 */
export declare function buildNvdUrl(cveId: string): string;
/**
 * Build ecosystem-specific package URL
 * Supports: npm, pypi, go, docker, maven
 * Also handles purl (Package URL) format
 */
export declare function buildPackageUrl(finding: Finding): string | null;
export {};
//# sourceMappingURL=linkHelpers.d.ts.map