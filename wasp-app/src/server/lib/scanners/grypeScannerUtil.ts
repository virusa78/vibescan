/**
 * Grype Scanner Utility - Executes Grype CLI and parses output
 * Grype is the free vulnerability scanner (Anchore)
 */

import { writeFileSync, existsSync, mkdirSync, unlinkSync } from 'fs';
import { resolve } from 'path';
import type { NormalizedComponent } from '../../services/inputAdapterService.js';
import { runGrypeCycloneDxScan, isToolAvailable } from './scannerRuntime.js';

export interface GrypeFinding {
  cveId: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  package: string;
  version: string;
  fixedVersion?: string;
  description: string;
  cvssScore: number;
  source: 'grype';
}

export type GrypeRawOutput = {
  matches?: GrypeMatch[];
};

type GrypeMatch = {
  vulnerability?: {
    id?: string;
    severity?: string;
    cvssScore?: {
      baseScore?: string | number;
    };
    description?: string;
    fix?: {
      versions?: string[];
    };
  };
  artifact?: {
    name?: string;
    version?: string;
  };
};

export type GrypeScanRun = {
  rawOutput: GrypeRawOutput;
  findings: GrypeFinding[];
  durationMs: number;
};

/**
 * Generate CycloneDX JSON SBOM from normalized components
 */
export function generateCycloneDxSbom(components: NormalizedComponent[]): string {
  const sbom = {
    bomFormat: 'CycloneDX',
    specVersion: '1.4',
    version: 1,
    components: components.map(c => ({
      type: c.type || 'library',
      name: c.name,
      version: c.version,
      purl: c.purl,
    })),
  };
  return JSON.stringify(sbom, null, 2);
}

/**
 * Parse Grype JSON output into normalized findings
 */
export function parseGrypOutput(rawOutput: GrypeRawOutput): GrypeFinding[] {
  if (!rawOutput || !rawOutput.matches || !Array.isArray(rawOutput.matches)) {
    return [];
  }

  const findings: GrypeFinding[] = [];

  for (const match of rawOutput.matches) {
    const vuln = match.vulnerability || {};
    const artifact = match.artifact || {};

    const finding: GrypeFinding = {
      cveId: vuln.id || 'UNKNOWN',
      severity: (vuln.severity || 'info').toLowerCase() as GrypeFinding['severity'],
      package: artifact.name || 'unknown',
      version: artifact.version || 'unknown',
      fixedVersion: vuln.fix?.versions?.[0],
      description: vuln.description || '',
      cvssScore: Number.parseFloat(String(vuln.cvssScore?.baseScore ?? '0')) || 0,
      source: 'grype',
    };

    findings.push(finding);
  }

  return findings;
}

/**
 * Main function: Scan components with Grype
 * @param components Normalized components to scan
 * @param scanId Unique scan ID for temporary files
 * @param timeoutMs Timeout in milliseconds
 * @returns Array of vulnerabilities found
 */
export async function scanWithGrype(
  components: NormalizedComponent[],
  scanId: string,
  timeoutMs: number = 300000
): Promise<GrypeFinding[]> {
  const result = await scanWithGrypeDetailed(components, scanId, timeoutMs);
  return result.findings;
}

export async function scanWithGrypeDetailed(
  components: NormalizedComponent[],
  scanId: string,
  timeoutMs: number = 300000
): Promise<GrypeScanRun> {
  let sbomPath: string | null = null;

  try {
    // Generate SBOM
    const sbomContent = generateCycloneDxSbom(components);

    // Write SBOM to temp file
    const scratchDir = resolve(process.cwd(), '.cache', 'grype');
    if (!existsSync(scratchDir)) {
        mkdirSync(scratchDir, { recursive: true });
    }
    sbomPath = resolve(scratchDir, `sbom-${scanId}.json`);
    writeFileSync(sbomPath, sbomContent);

    console.log(`[Grype] Generated SBOM at ${sbomPath}`);

    // Execute Grype using unified runtime (handles Docker fallback)
    const startTime = Date.now();
    const output = runGrypeCycloneDxScan(sbomPath, timeoutMs);
    const durationMs = Date.now() - startTime;

    const grypOutput = JSON.parse(output) as GrypeRawOutput;

    console.log(`[Grype] Executed in ${durationMs}ms`);

    // Parse output
    const findings = parseGrypOutput(grypOutput);

    console.log(`[Grype] Found ${findings.length} vulnerabilities`);

    return {
      rawOutput: grypOutput,
      findings,
      durationMs,
    };
  } catch (error) {
    console.error(`[Grype] Scan failed: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  } finally {
    // Cleanup temp file
    if (sbomPath && existsSync(sbomPath)) {
      try {
        unlinkSync(sbomPath);
      } catch (cleanupError) {
        console.error(`[Grype] Failed to cleanup SBOM:`, cleanupError);
      }
    }
  }
}

/**
 * Check if Grype is available (local or Docker)
 */
export function isGrypInstalled(): boolean {
  return isToolAvailable('grype');
}
