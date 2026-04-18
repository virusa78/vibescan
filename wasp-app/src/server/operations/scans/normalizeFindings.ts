/**
 * Normalize scanner outputs (Grype, Codescoring) to shared Finding schema
 */

export interface NormalizedFinding {
  cveId: string;
  severity: "critical" | "high" | "medium" | "low" | "info";
  package: string;
  version: string;
  fixedVersion?: string;
  description: string;
  cvssScore: number;
  source: "free" | "enterprise";
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
export function normalizeGrypeFindings(rawOutput: any): NormalizedFinding[] {
  if (!rawOutput || !rawOutput.matches || !Array.isArray(rawOutput.matches)) {
    return [];
  }

  return rawOutput.matches.map((match: any) => ({
    cveId: match.vulnerability?.id || "UNKNOWN",
    severity: (match.vulnerability?.severity || "info").toLowerCase() as any,
    package: match.artifact?.name || "unknown",
    version: match.artifact?.version || "unknown",
    fixedVersion: match.vulnerability?.fix?.versions?.[0],
    description: match.vulnerability?.description || "",
    cvssScore: parseFloat(match.vulnerability?.cvssScore?.baseScore || "0"),
    source: "free" as const,
  }));
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
export function normalizeCodescoringFindings(rawOutput: any): NormalizedFinding[] {
  if (!rawOutput || !rawOutput.components || !Array.isArray(rawOutput.components)) {
    return [];
  }

  const findings: NormalizedFinding[] = [];

  for (const component of rawOutput.components) {
    if (!component.vulnerabilities || !Array.isArray(component.vulnerabilities)) {
      continue;
    }

    for (const vuln of component.vulnerabilities) {
      findings.push({
        cveId: vuln.cveId || vuln.id || "UNKNOWN",
        severity: (vuln.severity || "info").toLowerCase() as any,
        package: component.name || "unknown",
        version: component.version || "unknown",
        fixedVersion: vuln.fixedVersion,
        description: vuln.description || "",
        cvssScore: parseFloat(vuln.cvssScore || "0"),
        source: "enterprise" as const,
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
export function computeFindingFingerprint(
  cveId: string,
  packageName: string,
  version: string,
  filePath?: string
): string {
  // Simple SHA256-like representation (for actual use, would use crypto.createHash)
  const input = `${cveId}|${packageName}|${version}|${filePath || ""}`;
  // In production, use: crypto.createHash('sha256').update(input).digest('hex')
  return input;
}
