/**
 * DiffEngine
 *
 * Pure functions for comparing free and enterprise scan results.
 * No external dependencies - easily testable.
 */

/**
 * Merge free and enterprise vulnerabilities
 * Deduplicates by cve_id, preferring enterprise versions
 * @param freeVulns - Free scanner vulnerabilities
 * @param enterpriseVulns - Enterprise scanner vulnerabilities
 * @returns Merged vulnerabilities array
 */
export function merge(
    freeVulns: any[],
    enterpriseVulns: any[]
): any[] {
    // Create a map of enterprise vulnerabilities by cve_id
    const enterpriseMap = new Map<string, any>();
    for (const vuln of enterpriseVulns) {
        if (vuln.cve_id) {
            enterpriseMap.set(vuln.cve_id, vuln);
        }
    }

    // Start with enterprise vulnerabilities (they have more data)
    const merged = new Map<string, any>();

    // Add all enterprise vulnerabilities
    for (const [cveId, vuln] of enterpriseMap) {
        merged.set(cveId, { ...vuln });
    }

    // Add free vulnerabilities that don't have an enterprise counterpart
    for (const vuln of freeVulns) {
        if (vuln.cve_id && !merged.has(vuln.cve_id)) {
            merged.set(vuln.cve_id, { ...vuln });
        } else if (!vuln.cve_id) {
            // Add free vulns without CVE ID
            merged.set(generateUniqueKey(vuln), { ...vuln });
        }
    }

    return Array.from(merged.values());
}

/**
 * Compute delta - vulnerabilities found only by enterprise scanner
 * @param freeVulns - Free scanner vulnerabilities
 * @param enterpriseVulns - Enterprise scanner vulnerabilities
 * @returns Delta calculation
 */
export function computeDelta(
    freeVulns: any[],
    enterpriseVulns: any[]
): {
    totalFreeCount: number;
    totalEnterpriseCount: number;
    deltaCount: number;
    deltaBySeverity: Record<string, number>;
    deltaVulnerabilities: any[];
} {
    // Create sets of CVE IDs
    const freeCves = new Set(freeVulns.map((v: any) => v.cve_id).filter(Boolean));
    const enterpriseCves = new Set(enterpriseVulns.map((v: any) => v.cve_id).filter(Boolean));

    // Find enterprise-only vulnerabilities
    const deltaVulns = rankVulnerabilities(
        enterpriseVulns.filter((v: any) => !freeCves.has(v.cve_id))
    );

    // Calculate severity breakdown
    const deltaBySeverity: Record<string, number> = {
        CRITICAL: 0,
        HIGH: 0,
        MEDIUM: 0,
        LOW: 0
    };

    for (const vuln of deltaVulns) {
        const severity = `${vuln.severity || ''}`.toUpperCase();
        if (severity in deltaBySeverity) {
            deltaBySeverity[severity]++;
        }
    }

    return {
        totalFreeCount: freeVulns.length,
        totalEnterpriseCount: enterpriseVulns.length,
        deltaCount: deltaVulns.length,
        deltaBySeverity,
        deltaVulnerabilities: deltaVulns
    };
}

/**
 * Compute severity breakdown for an array of vulnerabilities
 * @param vulns - Vulnerabilities to analyze
 * @returns Severity breakdown
 */
export function computeSeverityBreakdown(vulns: any[]): Record<string, number> {
    const breakdown: Record<string, number> = {
        CRITICAL: 0,
        HIGH: 0,
        MEDIUM: 0,
        LOW: 0
    };

    for (const vuln of vulns) {
        const severity = `${vuln.severity || ''}`.toUpperCase();
        if (severity in breakdown) {
            breakdown[severity]++;
        }
    }

    return breakdown;
}

/**
 * Rank vulnerabilities by severity, CVSS score, and exploitability
 * @param vulns - Vulnerabilities to rank
 * @returns Ranked vulnerabilities
 */
export function rankVulnerabilities(vulns: any[]): any[] {
    const severityOrder: Record<string, number> = {
        CRITICAL: 0,
        HIGH: 1,
        MEDIUM: 2,
        LOW: 3,
        INFO: 4
    };

    return [...vulns].sort((a: any, b: any) => {
        // First, sort by severity
        const severityA = severityOrder[a.severity] ?? 5;
        const severityB = severityOrder[b.severity] ?? 5;

        if (severityA !== severityB) {
            return severityA - severityB;
        }

        // Then by CVSS score (descending)
        const cvssA = a.cvss_score ?? 0;
        const cvssB = b.cvss_score ?? 0;

        if (cvssB !== cvssA) {
            return cvssB - cvssA;
        }

        // Then by exploitability (exploitable first)
        const exploitableA = a.is_exploitable ? 1 : 0;
        const exploitableB = b.is_exploitable ? 1 : 0;

        if (exploitableB !== exploitableA) {
            return exploitableB - exploitableA;
        }

        // Deterministic tie-breakers for stable ordering across runtimes.
        const identityA = `${a.cve_id || ''}|${a.package_name || ''}|${a.installed_version || ''}|${a.source || ''}`;
        const identityB = `${b.cve_id || ''}|${b.package_name || ''}|${b.installed_version || ''}|${b.source || ''}`;
        return identityA.localeCompare(identityB);
    });
}

/**
 * Generate a unique key for vulnerabilities without CVE ID
 */
function generateUniqueKey(vuln: any): string {
    return `pkg:${vuln.package_name}@${vuln.installed_version}`;
}

export default {
    merge,
    computeDelta,
    computeSeverityBreakdown,
    rankVulnerabilities
};
