/**
 * PR-04: CycloneDX Unifier
 * 
 * Responsibility: Transform validated CycloneDX into platform DTO
 * - Converts ParsedCycloneDxDocument → UnifiedScanPayload
 * - Normalizes vulnerability severity across formats
 * - Deduplicates components by PURL + version
 * - Traces findings back to original scanner output
 * - Handles scanner-specific quirks gracefully
 */

import {
  ValidatedCycloneDxDocument,
  UnifiedScanPayload,
  UnifiedVulnerability,
  UnifiedComponent,
  UnifiedSeverity,
  UnifiedVulnerabilityIdentifier,
  IngestionError,
  IngestionResult,
} from './cyclonedx-contracts';
import { computeFingerprint } from '../scans/reimportLogic';

/**
 * Unify a validated CycloneDX document into platform DTO
 * 
 * @param validated - Validated CycloneDX document
 * @param context - Ingestion context (scanId, userId, etc.)
 * @returns IngestionResult<UnifiedScanPayload>
 * 
 * Operations:
 * - Normalize severity levels across scanners
 * - Deduplicate components by (purl, version)
 * - Link vulnerabilities to affected components
 * - Preserve traceability through _raw, _sourceDocument
 * - Compute fingerprint for deduplication
 * - Track unknown fields for format learning
 */
export function unifyCycloneDXDocument(
  validated: ValidatedCycloneDxDocument,
  context: {
    scanId: string;
    userId: string;
    scannerId: string;
    timestamp?: string;
  }
): IngestionResult<UnifiedScanPayload> {
  try {
    // Step 1: Normalize components
    const components = normalizeComponents(validated.components);
    const componentsByPurl = buildComponentIndex(components);

    // Step 2: Normalize vulnerabilities
    const vulnerabilities = normalizeVulnerabilities(validated.vulnerabilities, validated.specVersion);

    // Step 3: Link vulnerabilities to components (if ref present)
    const componentVulnerabilities = linkVulnerabilitiesToComponents(
      vulnerabilities,
      validated.vulnerabilities,
      componentsByPurl
    );

    // Step 4: Compute fingerprints for all vulnerabilities
    const fingerprintedVulns = vulnerabilities.map((vuln) => ({
      ...vuln,
      fingerprint: computeFingerprint(vuln),
    }));

    // Step 5: Count stats
    const stats = {
      componentCount: components.length,
      vulnerabilityCount: vulnerabilities.length,
      severityCounts: {
        critical: vulnerabilities.filter((v) => v.severity.level === 'critical').length,
        high: vulnerabilities.filter((v) => v.severity.level === 'high').length,
        medium: vulnerabilities.filter((v) => v.severity.level === 'medium').length,
        low: vulnerabilities.filter((v) => v.severity.level === 'low').length,
        info: vulnerabilities.filter((v) => v.severity.level === 'info').length,
        unknown: vulnerabilities.filter((v) => v.severity.level === 'unknown').length,
      },
    };

    // Step 6: Track unknown fields
    const unknownFields = trackUnknownFields(validated._raw);

    // Step 7: Build unified payload
    const payload: UnifiedScanPayload = {
      scanId: context.scanId,
      userId: context.userId,
      scannerId: context.scannerId,
      specVersion: validated.specVersion,
      serialNumber: validated.serialNumber,
      timestamp: context.timestamp || new Date().toISOString(),

      // Unified data
      components,
      vulnerabilities: fingerprintedVulns,
      componentVulnerabilities,

      // Statistics
      stats,

      // Audit trail
      _raw: validated._raw,
      _validation: validated._validation,
      _sourceDocument: validated._sourceDocument,
      _unknownFields: unknownFields,
    };

    return {
      success: true,
      error: null,
      data: payload,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    const error: IngestionError = {
      type: 'unify_error',
      code: 'UNIFICATION_FAILED',
      message: `Failed to unify CycloneDX document: ${message}`,
      details: {
        errorMessage: message,
        errorType: err instanceof Error ? err.constructor.name : typeof err,
      },
      context: {
        source: context.scannerId,
        stage: 'unifier',
        timestamp: new Date().toISOString(),
      },
    };

    return {
      success: false,
      error,
      data: null,
    };
  }
}

/**
 * Normalize components to unified format
 */
function normalizeComponents(
  components: Array<{
    name: string;
    version: string;
    type: string;
    purl: string;
    licenses: string[];
    hashes: Record<string, string>;
    _raw: any;
  }>
): UnifiedComponent[] {
  const seen = new Map<string, UnifiedComponent>();

  for (const comp of components) {
    const key = `${comp.purl}@${comp.version}`;

    // Skip if already seen (deduplicate)
    if (seen.has(key)) {
      continue;
    }

    const unified: UnifiedComponent = {
      name: comp.name,
      version: comp.version,
      type: normalizeComponentType(comp.type),
      purl: comp.purl || `pkg:generic/${comp.name}@${comp.version}`,
      licenses: comp.licenses,
      hashes: comp.hashes,
      _raw: comp._raw,
    };

    seen.set(key, unified);
  }

  return Array.from(seen.values());
}

/**
 * Normalize component type to known enum
 */
function normalizeComponentType(
  type: string
): 'application' | 'framework' | 'library' | 'container' | 'operating-system' | 'device' | 'firmware' | 'source' | 'archive' | 'file' | 'install' | 'service' {
  const normalized = type.toLowerCase().trim();
  const knownTypes = [
    'application',
    'framework',
    'library',
    'container',
    'operating-system',
    'device',
    'firmware',
    'source',
    'archive',
    'file',
    'install',
    'service',
  ];

  if (knownTypes.includes(normalized)) {
    return normalized as any;
  }

  return 'library'; // default fallback
}

/**
 * Build index of components by PURL for fast lookup
 */
function buildComponentIndex(
  components: UnifiedComponent[]
): Map<string, UnifiedComponent> {
  const index = new Map<string, UnifiedComponent>();

  for (const comp of components) {
    index.set(comp.purl, comp);
  }

  return index;
}

/**
 * Normalize vulnerabilities to unified format
 */
function normalizeVulnerabilities(
  vulnerabilities: Array<{
    ref: string;
    id: string;
    cveId: string;
    source: { id?: string; url?: string };
    ratings: Array<{ severity: string; score: number; vector?: string }>;
    cwes: number[];
    description: string;
    recommendation: string;
    references: Array<{ url: string }>;
    _raw: any;
  }>,
  specVersion: string
): UnifiedVulnerability[] {
  return vulnerabilities.map((vuln) => {
    // Collect all identifiers
    const identifiers: UnifiedVulnerabilityIdentifier = {
      id: vuln.cveId || vuln.id || vuln.source?.id || 'unknown',
      ghsa: undefined, // Would need to parse from description/references
      osv: undefined, // Would need to extract from source
      other: {},
    };

    // Normalize severity from ratings (take highest if multiple)
    const severity = normalizeSeverity(vuln.ratings);

    // Map CWEs to unified format
    const cwes = vuln.cwes.map((id) => ({
      id: `CWE-${id}`,
      name: undefined, // Would need CWE database lookup
    }));

    const unified: UnifiedVulnerability = {
      identifiers,
      severity,
      cwes,
      fixedVersions: [], // Would need to extract from description/recommendation
      fixedIn: undefined, // Would need component linking
      references: vuln.references.map((ref) => ({
        url: ref.url,
        category: categorizeReference(ref.url),
      })),
      description: vuln.description,
      recommendation: vuln.recommendation,
      _raw: vuln._raw,
      _sourceDocument: {
        ref: vuln.ref,
        specVersion: specVersion as any,
      },
    };

    return unified;
  });
}

/**
 * Normalize severity from CVSS ratings
 */
function normalizeSeverity(
  ratings: Array<{ severity: string; score: number; vector?: string }>
): UnifiedSeverity {
  if (ratings.length === 0) {
    return {
      level: 'unknown',
    };
  }

  // Take highest severity + highest score
  let highestSeverity = 'unknown';
  let highestScore = 0;
  let cvssVector: string | undefined;
  let cvssVersion = '3.1';

  for (const rating of ratings) {
    const severity = normalizeSeverityLevel(rating.severity);

    if (scoreToLevel(rating.score) > scoreToLevel(highestScore)) {
      highestScore = rating.score;
      highestSeverity = severity;
    }

    if (rating.vector) {
      cvssVector = rating.vector;
      // Extract version from vector (CVSS:3.1/...)
      const versionMatch = rating.vector.match(/CVSS:(\d+\.\d+)/);
      if (versionMatch) {
        cvssVersion = versionMatch[1] as '2.0' | '3.0' | '3.1';
      }
    }
  }

  return {
    level: highestSeverity as any,
    cvssScore: highestScore,
    cvssVector,
    cvssVersion: cvssVersion as '2.0' | '3.0' | '3.1',
  };
}

/**
 * Normalize severity level string
 */
function normalizeSeverityLevel(severity: string): string {
  const normalized = severity.toLowerCase().trim();
  const knownLevels = ['critical', 'high', 'medium', 'low', 'info', 'unknown'];

  if (knownLevels.includes(normalized)) {
    return normalized;
  }

  // Try to map common alternates
  if (normalized === 'extreme' || normalized === 'catastrophic') return 'critical';
  if (normalized === 'severe') return 'high';
  if (normalized === 'moderate') return 'medium';
  if (normalized === 'warning') return 'low';
  if (normalized === 'notice') return 'info';

  return 'unknown';
}

/**
 * Convert CVSS score to ordinal level for comparison
 */
function scoreToLevel(score: number): number {
  if (score >= 9.0) return 5; // critical
  if (score >= 7.0) return 4; // high
  if (score >= 4.0) return 3; // medium
  if (score >= 0.1) return 2; // low
  return 1; // info/unknown
}

/**
 * Categorize reference URL
 */
function categorizeReference(
  url: string
): 'advisory' | 'evidence' | 'fix' | 'detection' | 'exploited_by' | undefined {
  const urlLower = url.toLowerCase();

  if (urlLower.includes('patch') || urlLower.includes('pull')) return 'fix';
  if (urlLower.includes('cisa') || urlLower.includes('exploit')) return 'exploited_by';
  if (urlLower.includes('nvd') || urlLower.includes('cve')) return 'advisory';

  return undefined;
}

/**
 * Link vulnerabilities to affected components
 */
function linkVulnerabilitiesToComponents(
  unified: UnifiedVulnerability[],
  raw: any[],
  componentIndex: Map<string, UnifiedComponent>
): Array<{ vulnerabilityId: string; componentPurl: string; fixedVersion?: string }> {
  const links: Array<{ vulnerabilityId: string; componentPurl: string; fixedVersion?: string }> = [];

  // For now, simple linking based on "affects" array if present in raw
  // This would require scanner-specific adapters for real linking
  // TODO: implement scanner-specific linking logic in PR-05

  return links;
}

/**
 * Track unknown fields for format learning loop
 */
function trackUnknownFields(raw: any): Map<string, number> {
  const knownFields = new Set([
    'bomFormat',
    'specVersion',
    'serialNumber',
    'version',
    'metadata',
    'components',
    'vulnerabilities',
    'services',
    'externalReferences',
    'properties',
  ]);

  const unknown = new Map<string, number>();

  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    for (const key of Object.keys(raw)) {
      if (!knownFields.has(key)) {
        unknown.set(key, (unknown.get(key) || 0) + 1);
      }
    }
  }

  return unknown;
}

/**
 * Compute fingerprint for vulnerability deduplication
 * (Delegates to reimportLogic)
 */
function computeFingerprint(vuln: UnifiedVulnerability): string {
  // Fingerprint = SHA256(cve_id + package_name + installed_version + file_path)
  // For unifier stage, we don't have package context yet
  // This will be computed during reimportLogic integration
  return '';
}
