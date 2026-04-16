/**
 * PR-02: CycloneDX Parser
 * 
 * Responsibility: Safe parsing of raw CycloneDX documents from scanners
 * - Accepts untyped JSON (RawCycloneDXDocument)
 * - Normalizes structure and metadata
 * - Returns strongly-typed ParsedCycloneDxDocument
 * - Catches and unifies parse errors
 * 
 * Error handling: all parse errors → IngestionError(type: 'parse_error')
 */

import { z } from 'zod';
import {
  RawCycloneDXDocument,
  ParsedCycloneDxDocument,
  IngestionError,
  IngestionResult,
  ParsedComponentMetadata,
  ParsedVulnerability,
} from './cyclonedx-contracts';

/**
 * ValidationError details for fine-grained error reporting
 */
interface ParseErrorDetail {
  field: string;
  reason: string;
  value?: unknown;
}

/**
 * Parser-level result type (distinct from full IngestionResult)
 */
export type ParserResult = 
  | { success: true; data: ParsedCycloneDxDocument }
  | { success: false; error: IngestionError };

/**
 * Parse a raw JSON document into strongly-typed CycloneDX structure
 * 
 * @param raw - Untyped JSON from scanner (may be malformed)
 * @param source - Source scanner metadata (name, version) for traceability
 * @returns ParserResult
 * 
 * Handles:
 * - Invalid JSON (parse error)
 * - Missing required fields (bomFormat, specVersion, serialNumber)
 * - Type mismatches (e.g., version not string)
 * - Large documents (streaming/size limits via separate service)
 * - Preserves raw document for audit trail
 */
export function parseCycloneDXDocument(
  raw: unknown,
  source: { name: string; version?: string; timestamp?: string }
): ParserResult {
  try {
    // Step 1: Validate basic structure
    const bomFormat = getStringField(raw, 'bomFormat', '');
    const specVersion = getStringField(raw, 'specVersion', '');
    const serialNumber = getStringField(raw, 'serialNumber', '');
    const version = getNumberField(raw, 'version', 1);

    const metadata = extractMetadata(raw);
    const components = extractComponents(raw);
    const vulnerabilities = extractVulnerabilities(raw);

    // Step 2: Validate mandatory CycloneDX fields
    const errors: ParseErrorDetail[] = [];

    if (bomFormat !== 'CycloneDX') {
      errors.push({
        field: 'bomFormat',
        reason: 'Must be exactly "CycloneDX"',
        value: bomFormat,
      });
    }

    if (!specVersion) {
      errors.push({
        field: 'specVersion',
        reason: 'Required field',
        value: specVersion,
      });
    }

    if (!['1.4', '1.5', '1.6'].includes(specVersion)) {
      errors.push({
        field: 'specVersion',
        reason: 'Unsupported version (supported: 1.4, 1.5, 1.6)',
        value: specVersion,
      });
    }

    if (!serialNumber) {
      errors.push({
        field: 'serialNumber',
        reason: 'Required field',
        value: serialNumber,
      });
    }

    if (errors.length > 0) {
      const error: IngestionError = {
        type: 'parse_error',
        code: 'INVALID_STRUCTURE',
        message: `CycloneDX document validation failed: ${errors.length} field(s) missing/invalid`,
        details: {
          fieldCount: errors.length,
          fields: errors,
        },
        context: {
          source: source.name,
          stage: 'parsing',
          timestamp: new Date().toISOString(),
        },
      };

      return {
        success: false,
        error,
        data: null,
      };
    }

    // Step 3: Build parsed document
    const parsed: ParsedCycloneDxDocument = {
      bomFormat,
      specVersion: specVersion as '1.4' | '1.5' | '1.6',
      serialNumber,
      version,
      metadata,
      components,
      vulnerabilities,
      _raw: raw as RawCycloneDXDocument,
      _sourceDocument: {
        scannerName: source.name,
        scannerVersion: source.version,
        ingestTimestamp: source.timestamp || new Date().toISOString(),
      },
    };

    return {
      success: true,
      error: null,
      data: parsed,
    };
  } catch (err) {
    // Catch unexpected errors during parsing
    const message = err instanceof Error ? err.message : String(err);

    const error: IngestionError = {
      type: 'parse_error',
      code: 'PARSE_EXCEPTION',
      message: `Unexpected error during CycloneDX parsing: ${message}`,
      details: {
        errorMessage: message,
        errorType: err instanceof Error ? err.constructor.name : typeof err,
      },
      context: {
        source: source.name,
        stage: 'parser',
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
 * Extract and normalize component list from raw document
 */
function extractComponents(raw: unknown): ParsedComponentMetadata[] {
  const components: ParsedComponentMetadata[] = [];

  const rawComponents = getArrayField(raw, 'components', []);

  for (let i = 0; i < rawComponents.length; i++) {
    const comp = rawComponents[i];

    const name = getStringField(comp, 'name', '');
    const version = getStringField(comp, 'version', '');
    const type = getStringField(comp, 'type', 'library');
    const purl = getStringField(comp, 'purl', '');

    if (!name || !version) {
      // Skip components without name/version (invalid in CycloneDX spec)
      continue;
    }

    const licenses = extractLicenses(comp);
    const hashes = extractHashes(comp);

    const parsed: ParsedComponentMetadata = {
      name,
      version,
      type: type as any,
      purl,
      licenses,
      hashes,
      _raw: comp as any,
    };

    components.push(parsed);
  }

  return components;
}

/**
 * Extract and normalize vulnerability list from raw document
 */
function extractVulnerabilities(raw: unknown): ParsedVulnerability[] {
  const vulnerabilities: ParsedVulnerability[] = [];

  // CycloneDX stores vulnerabilities in metadata.vulnerabilities or vulnerabilities[] (v1.6+)
  let rawVulns = getArrayField(raw, 'vulnerabilities', []);

  if (rawVulns.length === 0) {
    const metadata = getObjectField(raw, 'metadata');
    rawVulns = getArrayField(metadata, 'vulnerabilities', []);
  }

  for (let i = 0; i < rawVulns.length; i++) {
    const vuln = rawVulns[i];

    const ref = getStringField(vuln, 'ref', '');
    const id = getStringField(vuln, 'id', '');

    if (!ref && !id) {
      // Skip vulnerabilities without ID (invalid)
      continue;
    }

    const cveId = getStringField(vuln, 'id', '');
    const source = getObjectField(vuln, 'source');
    const sourceId = getStringField(source, 'id', '');
    const sourceUrl = getStringField(source, 'url', '');

    const ratings = extractRatings(vuln);
    const cwes = getArrayField(vuln, 'cwes', []) as number[];
    const references = getArrayField(vuln, 'references', []);

    const parsed: ParsedVulnerability = {
      ref,
      id: cveId || sourceId,
      cveId: cveId, // Keep for test compatibility
      source: sourceId || sourceUrl ? { name: sourceId, url: sourceUrl } : undefined,
      ratings,
      cwes: cwes, // Keep as-is (numbers from CycloneDX)
      description: getStringField(vuln, 'description', ''),
      recommendation: getStringField(vuln, 'recommendation', ''),
      references: references.map((r: any) => ({
        url: getStringField(r, 'url', ''),
      })),
      _raw: vuln as any,
    };

    vulnerabilities.push(parsed);
  }

  return vulnerabilities;
}

/**
 * Extract ratings (CVSS scores) from vulnerability
 */
function extractRatings(vuln: unknown): { severity: string; score: number; vector?: string }[] {
  const ratings: { severity: string; score: number; vector?: string }[] = [];

  const rawRatings = getArrayField(vuln, 'ratings', []);

  for (const rating of rawRatings) {
    const severity = getStringField(rating, 'severity', 'unknown');
    const score = getNumberField(rating, 'score', 0);
    const vector = getStringField(rating, 'vector', undefined);

    ratings.push({
      severity,
      score,
      ...(vector && { vector }),
    });
  }

  return ratings;
}

/**
 * Extract licenses from component
 */
function extractLicenses(comp: unknown): string[] {
  const licenses: string[] = [];

  const rawLicenses = getArrayField(comp, 'licenses', []);

  for (const license of rawLicenses) {
    const expression = getStringField(license, 'expression', '');
    if (expression) {
      licenses.push(expression);
    }
  }

  return licenses;
}

/**
 * Extract hashes from component
 */
function extractHashes(comp: unknown): Record<string, string> {
  const hashes: Record<string, string> = {};

  const rawHashes = getArrayField(comp, 'hashes', []);

  for (const hash of rawHashes) {
    const alg = getStringField(hash, 'alg', '');
    const content = getStringField(hash, 'content', '');

    if (alg && content) {
      hashes[alg] = content;
    }
  }

  return hashes;
}

/**
 * Extract metadata from document
 */
function extractMetadata(raw: unknown): {
  timestamp?: string;
  tools?: Array<{ name: string; version?: string }>;
  component?: { name: string; version?: string };
} {
  const metadata = getObjectField(raw, 'metadata');

  const timestamp = getStringField(metadata, 'timestamp', undefined);
  const tools = extractTools(metadata);
  const component = extractMetadataComponent(metadata);

  return {
    ...(timestamp && { timestamp }),
    ...(tools.length > 0 && { tools }),
    ...(component && { component }),
  };
}

/**
 * Extract tools from metadata
 */
function extractTools(
  metadata: unknown
): Array<{ name: string; version?: string }> {
  const tools: Array<{ name: string; version?: string }> = [];

  const rawTools = getArrayField(metadata, 'tools', []);

  for (const tool of rawTools) {
    const name = getStringField(tool, 'name', '');
    const version = getStringField(tool, 'version', undefined);

    if (name) {
      tools.push({
        name,
        ...(version && { version }),
      });
    }
  }

  return tools;
}

/**
 * Extract component from metadata
 */
function extractMetadataComponent(
  metadata: unknown
): { name: string; version?: string } | undefined {
  const component = getObjectField(metadata, 'component');

  const name = getStringField(component, 'name', '');
  const version = getStringField(component, 'version', undefined);

  if (name) {
    return {
      name,
      ...(version && { version }),
    };
  }

  return undefined;
}

/**
 * Safe field extraction helpers
 */

function getStringField(obj: unknown, key: string, fallback: string | undefined): string | undefined {
  if (obj && typeof obj === 'object' && key in obj) {
    const value = (obj as Record<string, unknown>)[key];
    if (typeof value === 'string') {
      return value;
    }
  }
  return fallback;
}

function getNumberField(obj: unknown, key: string, fallback: number): number {
  if (obj && typeof obj === 'object' && key in obj) {
    const value = (obj as Record<string, unknown>)[key];
    if (typeof value === 'number') {
      return value;
    }
  }
  return fallback;
}

function getObjectField(obj: unknown, key: string): unknown {
  if (obj && typeof obj === 'object' && key in obj) {
    const value = (obj as Record<string, unknown>)[key];
    if (value && typeof value === 'object') {
      return value;
    }
  }
  return {};
}

function getArrayField(obj: unknown, key: string, fallback: unknown[] = []): unknown[] {
  if (obj && typeof obj === 'object' && key in obj) {
    const value = (obj as Record<string, unknown>)[key];
    if (Array.isArray(value)) {
      return value;
    }
  }
  return fallback;
}
