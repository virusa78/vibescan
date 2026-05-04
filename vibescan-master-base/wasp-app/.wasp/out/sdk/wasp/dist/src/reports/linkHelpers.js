/**
 * External link generation helpers for report findings
 */
/**
 * Resolve CVE ID from finding data
 * Checks cveId field first, falls back to cve field
 */
export function resolveCveId(finding) {
    return finding.cveId ?? finding.cve ?? '';
}
/**
 * Build GitHub Advisory search URL for a CVE
 */
export function buildGitHubAdvisoryUrl(cveId) {
    return `https://github.com/advisories?query=${encodeURIComponent(cveId)}`;
}
/**
 * Build NVD (National Vulnerability Database) detail URL for a CVE
 */
export function buildNvdUrl(cveId) {
    return `https://nvd.nist.gov/vuln/detail/${encodeURIComponent(cveId)}`;
}
/**
 * Build ecosystem-specific package URL
 * Supports: npm, pypi, go, docker, maven
 * Also handles purl (Package URL) format
 */
export function buildPackageUrl(finding) {
    const pkg = (finding.packageName ?? '').trim();
    if (!pkg)
        return null;
    const ecosystem = (finding.ecosystem ?? '').toLowerCase();
    // Standard ecosystem names
    if (ecosystem === 'npm')
        return `https://www.npmjs.com/package/${encodeURIComponent(pkg)}`;
    if (ecosystem === 'pypi')
        return `https://pypi.org/project/${encodeURIComponent(pkg)}/`;
    if (ecosystem === 'go')
        return `https://pkg.go.dev/${pkg}`;
    if (ecosystem === 'docker')
        return `https://hub.docker.com/_/${encodeURIComponent(pkg)}`;
    if (ecosystem === 'maven' && pkg.includes(':')) {
        const [group, artifact] = pkg.split(':');
        if (group && artifact) {
            return `https://central.sonatype.com/artifact/${group}/${artifact}`;
        }
    }
    // Package URL (purl) format support
    if (pkg.startsWith('pkg:npm/')) {
        return `https://www.npmjs.com/package/${encodeURIComponent(pkg.slice('pkg:npm/'.length))}`;
    }
    if (pkg.startsWith('pkg:pypi/')) {
        return `https://pypi.org/project/${encodeURIComponent(pkg.slice('pkg:pypi/'.length))}/`;
    }
    if (pkg.startsWith('pkg:golang/')) {
        return `https://pkg.go.dev/${pkg.slice('pkg:golang/'.length)}`;
    }
    if (pkg.startsWith('pkg:docker/')) {
        return `https://hub.docker.com/_/${encodeURIComponent(pkg.slice('pkg:docker/'.length))}`;
    }
    return null;
}
//# sourceMappingURL=linkHelpers.js.map