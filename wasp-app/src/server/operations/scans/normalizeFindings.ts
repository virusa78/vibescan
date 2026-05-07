/**
 * Normalize scanner outputs (Grype, Codescoring, Snyk, Syft, OWASP) to shared Finding schema
 */

export interface NormalizedFinding {
  cveId: string;
  severity: "critical" | "high" | "medium" | "low" | "info";
  package: string;
  version: string;
  fixedVersion?: string;
  description: string;
  cvssScore: number;
  source: "grype" | "codescoring_johnny" | "snyk" | "owasp" | "trivy";
  filePath?: string;
}

type UnknownRecord = Record<string, unknown>;

type GrypeMatch = {
  vulnerability?: {
    id?: string;
    severity?: string;
    description?: string;
    fix?: {
      versions?: string[];
    };
    cvssScore?: {
      baseScore?: string | number;
    };
  };
  artifact?: {
    name?: string;
    version?: string;
  };
};

type CodescoringVulnerability = {
  cveId?: string;
  id?: string;
  severity?: string;
  fixedVersion?: string;
  description?: string;
  cvssScore?: string | number;
};

type CodescoringComponent = {
  name?: string;
  version?: string;
  vulnerabilities?: CodescoringVulnerability[];
};

function isRecord(value: unknown): value is UnknownRecord {
  return !!value && typeof value === 'object';
}

function parseSeverity(value: string | undefined): NormalizedFinding['severity'] {
  const normalized = (value || 'info').toLowerCase();
  if (normalized === 'critical' || normalized === 'high' || normalized === 'medium' || normalized === 'low') {
    return normalized;
  }
  return 'info';
}

function parseScore(value: string | number | undefined): number {
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
export function normalizeGrypeFindings(rawOutput: unknown): NormalizedFinding[] {
  if (!isRecord(rawOutput) || !Array.isArray(rawOutput.matches)) {
    return [];
  }

  return rawOutput.matches.map((match) => {
    const typedMatch = (isRecord(match) ? match : {}) as GrypeMatch;
    return {
    cveId: typedMatch.vulnerability?.id || "UNKNOWN",
    severity: parseSeverity(typedMatch.vulnerability?.severity),
    package: typedMatch.artifact?.name || "unknown",
    version: typedMatch.artifact?.version || "unknown",
    fixedVersion: typedMatch.vulnerability?.fix?.versions?.[0],
    description: typedMatch.vulnerability?.description || "",
    cvssScore: parseScore(typedMatch.vulnerability?.cvssScore?.baseScore),
    source: "grype" as const,
    filePath: (typedMatch.artifact as any)?.locations?.[0]?.path,
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
export function normalizeCodescoringFindings(rawOutput: unknown): NormalizedFinding[] {
  if (!isRecord(rawOutput) || !Array.isArray(rawOutput.components)) {
    return [];
  }

  const findings: NormalizedFinding[] = [];

  for (const component of rawOutput.components) {
    const typedComponent = (isRecord(component) ? component : {}) as CodescoringComponent;
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
        source: "codescoring_johnny" as const,
        filePath: (typedComponent as any).path || (typedComponent as any).location,
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

/**
 * Normalize Trivy CycloneDX output to Finding array
 */
export function normalizeTrivyFindings(rawOutput: unknown): NormalizedFinding[] {
  // Trivy CycloneDX format is very similar to Syft's
  if (!isRecord(rawOutput)) {
    return [];
  }

  const vulnerabilities = Array.isArray(rawOutput.vulnerabilities) ? rawOutput.vulnerabilities : [];
  const components = Array.isArray(rawOutput.components) ? rawOutput.components : [];

  // Build component map
  const componentMap = new Map<string, { name: string; version: string; properties?: any[] }>();
  for (const comp of components) {
    if (isRecord(comp)) {
      const bomRef = comp['bom-ref'] as string || comp.purl as string;
      if (bomRef) {
        componentMap.set(bomRef, {
          name: comp.name as string || 'unknown',
          version: comp.version as string || 'unknown',
          properties: Array.isArray(comp.properties) ? comp.properties : undefined,
        });
      }
    }
  }

  const findings: NormalizedFinding[] = [];

  for (const vuln of vulnerabilities) {
    if (!isRecord(vuln)) continue;

    const severity = isRecord(vuln.ratings) && Array.isArray(vuln.ratings)
      ? parseSeverity((vuln.ratings[0] as UnknownRecord)?.severity as string | undefined)
      : 'info';

    const cvssScore = isRecord(vuln.ratings) && Array.isArray(vuln.ratings)
      ? parseScore((vuln.ratings[0] as UnknownRecord)?.score as string | number | undefined)
      : 0;

    const fixes = Array.isArray(vuln.fixes) ? vuln.fixes : [];
    const fixedVersion = (fixes[0] as UnknownRecord)?.version as string | undefined;

    const ref = vuln.ref as string;
    const component = ref ? componentMap.get(ref) : null;
    const componentProps = (component as any)?.properties || [];
    const locationProp = Array.isArray(componentProps) 
      ? componentProps.find((p: any) => p.name === 'trivy:location' || p.name.startsWith('syft:location:')) 
      : null;

    findings.push({
      cveId: (vuln.id as string) || 'UNKNOWN',
      severity,
      package: component?.name || (vuln.ref as string) || 'unknown',
      version: component?.version || 'unknown',
      fixedVersion,
      description: (vuln.description as string) || '',
      cvssScore,
      source: 'trivy' as const,
      filePath: locationProp?.value,
    });
  }

  return findings;
}

/**
 * Normalize OWASP Dependency-Check output to Finding array
 * OWASP generates its own JSON format with vulnerability metadata
 */
export function normalizeOwaspFindings(rawOutput: unknown): NormalizedFinding[] {
  if (!isRecord(rawOutput)) {
    return [];
  }

  const findings: NormalizedFinding[] = [];

  // OWASP format has vulnerabilities at root level
  if (Array.isArray((rawOutput as any).vulnerabilities)) {
    for (const vuln of (rawOutput as any).vulnerabilities) {
      if (!isRecord(vuln)) continue;

      const severity = parseSeverity((vuln.severity as string | undefined));
      const cvssScore = parseScore((vuln.cvssScore as string | number | undefined));

      findings.push({
        cveId: (vuln.cve as string) || (vuln.name as string) || 'UNKNOWN',
        severity,
        package: (vuln.artifactId as string) || 'unknown',
        version: (vuln.artifactVersion as string) || 'unknown',
        fixedVersion: undefined, // OWASP doesn't typically provide fixed version
        description: (vuln.description as string) || '',
        cvssScore,
        source: 'owasp' as const,
      });
    }
  }

  return findings;
}
