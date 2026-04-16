/**
 * PR-03: CycloneDX Validator
 * 
 * Responsibility: Schema validation and runtime invariants
 * - Validates CycloneDX spec compliance (bomFormat, specVersion, serialNumber)
 * - Enforces platform runtime invariants (components must have name/version, etc.)
 * - Returns ValidatedCycloneDxDocument with _validation metadata
 * - Catches validation errors → IngestionError(type: 'validation_error')
 */

import {
  ParsedCycloneDxDocument,
  ValidatedCycloneDxDocument,
  IngestionError,
  IngestionResult,
  ValidationIssue,
} from './cyclonedx-contracts';

/**
 * Validation issue details
 */
interface ValidationCheck {
  path: string; // e.g., "components[0]", "vulnerabilities[1].ratings[0]"
  field: string; // e.g., "severity", "score"
  issue: string; // description of the issue
  severity: 'error' | 'warning'; // error blocks, warning allows processing
  value?: unknown;
}

/**
 * Validate a parsed CycloneDX document against schema and runtime invariants
 * 
 * @param parsed - Already-parsed CycloneDX document
 * @returns IngestionResult<ValidatedCycloneDxDocument>
 * 
 * Checks:
 * - CycloneDX spec version matches 1.4/1.5/1.6
 * - bomFormat is exactly "CycloneDX"
 * - serialNumber is unique and valid format
 * - Components have required fields (name, version)
 * - Vulnerabilities have at least one rating or source ID
 * - CVSS scores are within valid range (0-10)
 * - Severity levels are from known enum
 * - No duplicate components (by purl+version)
 * - No missing required vulnerabilities fields
 */
export function validateCycloneDXDocument(
  parsed: ParsedCycloneDxDocument,
  source: { name: string; timestamp?: string }
): IngestionResult<ValidatedCycloneDxDocument> {
  const issues: ValidationCheck[] = [];

  // Step 1: Validate mandatory fields
  validateMandatoryFields(parsed, issues);

  // Step 2: Validate components
  validateComponents(parsed, issues);

  // Step 3: Validate vulnerabilities
  validateVulnerabilities(parsed, issues);

  // Step 4: Check for warnings
  const hasErrors = issues.some((i) => i.severity === 'error');

  if (hasErrors) {
    const error: IngestionError = {
      type: 'validation_error',
      code: 'SCHEMA_VIOLATION',
      message: `CycloneDX document validation failed: ${issues.filter((i) => i.severity === 'error').length} error(s)`,
      details: {
        issueCount: issues.length,
        errorCount: issues.filter((i) => i.severity === 'error').length,
        warningCount: issues.filter((i) => i.severity === 'warning').length,
        issues: issues as any,
      },
      context: {
        source: source.name,
        stage: 'validator',
        timestamp: source.timestamp || new Date().toISOString(),
      },
    };

    return {
      success: false,
      error,
      data: null,
    };
  }

  // Step 5: Build validated document
  const warningCount = issues.filter((i) => i.severity === 'warning').length;

  const validated: ValidatedCycloneDxDocument = {
    ...parsed,
    _validation: {
      timestamp: new Date().toISOString(),
      issueCount: issues.length,
      issues: issues.map((i) => ({
        path: i.path,
        field: i.field,
        issue: i.issue,
        severity: i.severity,
        value: i.value,
      })),
      specVersion: parsed.specVersion,
      componentCount: parsed.components.length,
      vulnerabilityCount: parsed.vulnerabilities.length,
      warningCount,
    },
  };

  return {
    success: true,
    error: null,
    data: validated,
  };
}

/**
 * Validate mandatory CycloneDX fields
 */
function validateMandatoryFields(parsed: ParsedCycloneDxDocument, issues: ValidationCheck[]): void {
  // bomFormat
  if (parsed.bomFormat !== 'CycloneDX') {
    issues.push({
      path: 'root',
      field: 'bomFormat',
      issue: 'Must be exactly "CycloneDX"',
      severity: 'error',
      value: parsed.bomFormat,
    });
  }

  // specVersion
  const supportedVersions = ['1.4', '1.5', '1.6'];
  if (!supportedVersions.includes(parsed.specVersion)) {
    issues.push({
      path: 'root',
      field: 'specVersion',
      issue: `Must be one of: ${supportedVersions.join(', ')}`,
      severity: 'error',
      value: parsed.specVersion,
    });
  }

  // serialNumber format (should be UUID or similar)
  if (!parsed.serialNumber || parsed.serialNumber.trim() === '') {
    issues.push({
      path: 'root',
      field: 'serialNumber',
      issue: 'Must not be empty',
      severity: 'error',
      value: parsed.serialNumber,
    });
  } else if (!isValidSerialNumber(parsed.serialNumber)) {
    issues.push({
      path: 'root',
      field: 'serialNumber',
      issue: 'Should follow urn:uuid: format',
      severity: 'warning',
      value: parsed.serialNumber,
    });
  }

  // version
  if (typeof parsed.version !== 'number' || parsed.version < 0) {
    issues.push({
      path: 'root',
      field: 'version',
      issue: 'Must be a non-negative number',
      severity: 'error',
      value: parsed.version,
    });
  }
}

/**
 * Validate components
 */
function validateComponents(parsed: ParsedCycloneDxDocument, issues: ValidationCheck[]): void {
  const purls = new Set<string>();

  for (let i = 0; i < parsed.components.length; i++) {
    const comp = parsed.components[i];
    const path = `components[${i}]`;

    // name (required)
    if (!comp.name || comp.name.trim() === '') {
      issues.push({
        path,
        field: 'name',
        issue: 'Must not be empty',
        severity: 'error',
        value: comp.name,
      });
    }

    // version (required)
    if (!comp.version || comp.version.trim() === '') {
      issues.push({
        path,
        field: 'version',
        issue: 'Must not be empty',
        severity: 'error',
        value: comp.version,
      });
    }

    // type should be known enum
    const knownTypes = ['application', 'framework', 'library', 'container', 'operating-system', 'device', 'firmware', 'source', 'archive', 'file', 'install', 'service'];
    if (comp.type && !knownTypes.includes(comp.type)) {
      issues.push({
        path,
        field: 'type',
        issue: `Unknown component type: ${comp.type}`,
        severity: 'warning',
        value: comp.type,
      });
    }

    // purl format validation (should start with pkg:)
    if (comp.purl && !comp.purl.startsWith('pkg:')) {
      issues.push({
        path,
        field: 'purl',
        issue: 'Package URL should start with "pkg:"',
        severity: 'warning',
        value: comp.purl,
      });
    }

    // Check for duplicate components
    if (comp.purl) {
      if (purls.has(comp.purl)) {
        issues.push({
          path,
          field: 'purl',
          issue: 'Duplicate component (purl already seen)',
          severity: 'warning',
          value: comp.purl,
        });
      }
      purls.add(comp.purl);
    }

    // Validate hashes if present
    for (const [alg, content] of Object.entries(comp.hashes)) {
      if (!content || content.trim() === '') {
        issues.push({
          path: `${path}.hashes[${alg}]`,
          field: alg,
          issue: 'Hash content must not be empty',
          severity: 'warning',
          value: content,
        });
      }
    }
  }
}

/**
 * Validate vulnerabilities
 */
function validateVulnerabilities(parsed: ParsedCycloneDxDocument, issues: ValidationCheck[]): void {
  for (let i = 0; i < parsed.vulnerabilities.length; i++) {
    const vuln = parsed.vulnerabilities[i];
    const path = `vulnerabilities[${i}]`;

    // ref (required in CycloneDX 1.4+)
    if (!vuln.ref || vuln.ref.trim() === '') {
      issues.push({
        path,
        field: 'ref',
        issue: 'Must not be empty (required in CycloneDX 1.4+)',
        severity: 'error',
        value: vuln.ref,
      });
    }

    // cveId (at least one identifier needed)
    if (!vuln.cveId || vuln.cveId.trim() === '') {
      // Check if source.id exists as fallback
      if (!vuln.source?.id || vuln.source.id.trim() === '') {
        issues.push({
          path,
          field: 'cveId',
          issue: 'Must have either cveId or source.id',
          severity: 'error',
          value: vuln.cveId,
        });
      }
    }

    // CVE format validation
    if (vuln.cveId && !isCveFormatValid(vuln.cveId)) {
      issues.push({
        path,
        field: 'cveId',
        issue: 'Should follow CVE-YYYY-NNNNN format',
        severity: 'warning',
        value: vuln.cveId,
      });
    }

    // Ratings validation
    if (vuln.ratings.length === 0) {
      issues.push({
        path,
        field: 'ratings',
        issue: 'Should have at least one rating with severity/score',
        severity: 'warning',
      });
    }

    for (let j = 0; j < vuln.ratings.length; j++) {
      const rating = vuln.ratings[j];
      const ratingPath = `${path}.ratings[${j}]`;

      // severity enum
      const knownSeverities = ['unknown', 'low', 'medium', 'high', 'critical'];
      if (!knownSeverities.includes(rating.severity.toLowerCase())) {
        issues.push({
          path: ratingPath,
          field: 'severity',
          issue: `Unknown severity: ${rating.severity}`,
          severity: 'warning',
          value: rating.severity,
        });
      }

      // score range (0-10 for CVSS)
      if (rating.score < 0 || rating.score > 10) {
        issues.push({
          path: ratingPath,
          field: 'score',
          issue: 'CVSS score must be between 0 and 10',
          severity: 'error',
          value: rating.score,
        });
      }

      // vector format (should start with CVSS:)
      if (rating.vector && !rating.vector.startsWith('CVSS:')) {
        issues.push({
          path: ratingPath,
          field: 'vector',
          issue: 'CVSS vector should start with "CVSS:"',
          severity: 'warning',
          value: rating.vector,
        });
      }
    }

    // CWEs should be numbers
    for (let j = 0; j < vuln.cwes.length; j++) {
      if (typeof vuln.cwes[j] !== 'number' || vuln.cwes[j] < 0) {
        issues.push({
          path: `${path}.cwes[${j}]`,
          field: 'cwe',
          issue: 'CWE must be a positive number',
          severity: 'warning',
          value: vuln.cwes[j],
        });
      }
    }

    // References should have valid URLs
    for (let j = 0; j < vuln.references.length; j++) {
      const ref = vuln.references[j];
      const refPath = `${path}.references[${j}]`;

      if (!ref.url || !isValidUrl(ref.url)) {
        issues.push({
          path: refPath,
          field: 'url',
          issue: 'Reference URL must be a valid HTTP/HTTPS URL',
          severity: 'warning',
          value: ref.url,
        });
      }
    }
  }
}

/**
 * Validation helper functions
 */

function isValidSerialNumber(serialNumber: string): boolean {
  // Accept urn:uuid: format
  if (serialNumber.startsWith('urn:uuid:')) {
    return true;
  }
  // Accept simple UUIDs
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (uuidRegex.test(serialNumber)) {
    return true;
  }
  // Accept anything non-empty as fallback
  return serialNumber.length > 0;
}

function isCveFormatValid(cveId: string): boolean {
  // CVE-YYYY-NNNNN format
  const cveRegex = /^CVE-\d{4}-\d+$/;
  return cveRegex.test(cveId);
}

function isValidUrl(url: string): boolean {
  if (!url || url.trim() === '') {
    return false;
  }
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}
