/**
 * Normalize scanner outputs (Grype, Codescoring) to shared Finding schema
 */
function isRecord(value) {
    return !!value && typeof value === 'object';
}
function parseSeverity(value) {
    const normalized = (value || 'info').toLowerCase();
    if (normalized === 'critical' || normalized === 'high' || normalized === 'medium' || normalized === 'low') {
        return normalized;
    }
    return 'info';
}
function parseScore(value) {
    return Number.parseFloat(String(value ?? '0')) || 0;
}
/**
 * Normalize Grype JSON output to Finding array
 * Expected Grype format:
 * {
 *   "matches": [
 *     {
 *       "vulnerability": { "id": "CVE-...", "severity": "...", "cvssScore": ... },
 *       "artifact": { "name": "package", "version": "1.0" },
 *       "matchDetails": [{ "found": ... }]
 *     }
 *   ]
 * }
 */
export function normalizeGrypeFindings(rawOutput) {
    if (!isRecord(rawOutput) || !Array.isArray(rawOutput.matches)) {
        return [];
    }
    return rawOutput.matches.map((match) => {
        const typedMatch = (isRecord(match) ? match : {});
        return {
            cveId: typedMatch.vulnerability?.id || "UNKNOWN",
            severity: parseSeverity(typedMatch.vulnerability?.severity),
            package: typedMatch.artifact?.name || "unknown",
            version: typedMatch.artifact?.version || "unknown",
            fixedVersion: typedMatch.vulnerability?.fix?.versions?.[0],
            description: typedMatch.vulnerability?.description || "",
            cvssScore: parseScore(typedMatch.vulnerability?.cvssScore?.baseScore),
            source: "grype",
        };
    });
}
/**
 * Normalize Codescoring/BlackDuck JSON output to Finding array
 * Expected format:
 * {
 *   "components": [
 *     {
 *       "name": "package",
 *       "version": "1.0",
 *       "vulnerabilities": [
 *         { "cveId": "CVE-...", "severity": "...", "cvssScore": ... }
 *       ]
 *     }
 *   ]
 * }
 */
export function normalizeCodescoringFindings(rawOutput) {
    if (!isRecord(rawOutput) || !Array.isArray(rawOutput.components)) {
        return [];
    }
    const findings = [];
    for (const component of rawOutput.components) {
        const typedComponent = (isRecord(component) ? component : {});
        if (!Array.isArray(typedComponent.vulnerabilities)) {
            continue;
        }
        for (const vuln of typedComponent.vulnerabilities) {
            findings.push({
                cveId: vuln.cveId || vuln.id || "UNKNOWN",
                severity: parseSeverity(vuln.severity),
                package: typedComponent.name || "unknown",
                version: typedComponent.version || "unknown",
                fixedVersion: vuln.fixedVersion,
                description: vuln.description || "",
                cvssScore: parseScore(vuln.cvssScore),
                source: "codescoring_johnny",
            });
        }
    }
    return findings;
}
/**
 * Compute fingerprint for deduplication
 * Fingerprint = hash(cveId + package + version + filePath)
 * Used to track the same vulnerability across multiple scans
 */
export function computeFindingFingerprint(cveId, packageName, version, filePath) {
    // Simple SHA256-like representation (for actual use, would use crypto.createHash)
    const input = `${cveId}|${packageName}|${version}|${filePath || ""}`;
    // In production, use: crypto.createHash('sha256').update(input).digest('hex')
    return input;
}
//# sourceMappingURL=normalizeFindings.js.map