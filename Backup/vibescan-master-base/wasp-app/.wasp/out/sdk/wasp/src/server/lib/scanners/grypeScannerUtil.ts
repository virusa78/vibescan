/**
 * Grype Scanner Utility - Executes Grype CLI and parses output
 * Grype is the free vulnerability scanner (Anchore)
 */

import { execSync } from 'child_process';
import { writeFileSync, unlinkSync, existsSync, mkdirSync } from 'fs';
import { resolve } from 'path';
import type { NormalizedComponent } from '../../services/inputAdapterService.js';

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

function isGrypeMissingError(error: unknown): boolean {
  if (error && typeof error === 'object' && 'code' in error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') {
      return true;
    }
  }

  const message = error instanceof Error ? error.message : String(error);
  return /grype/i.test(message) && /(not found|enoent)/i.test(message);
}

/**
 * Generate CycloneDX JSON SBOM from normalized components
 */
function generateCycloneDxSbom(components: NormalizedComponent[]): string {
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
 * Execute Grype CLI with timeout
 * @param sbomPath Path to SBOM file
 * @param timeoutMs Timeout in milliseconds (default: 5 minutes)
 * @returns Grype JSON output
 */
export async function executeGrypeCli(
  sbomPath: string,
  timeoutMs: number = 300000
): Promise<GrypeRawOutput> {
  return new Promise((resolve, reject) => {
    try {
      // Execute: grype sbom:/path/to/sbom.json -o json
      const command = `grype sbom:${sbomPath} -o json`;
      
      const timeout = setTimeout(() => {
        reject(new Error(`Grype execution timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      try {
        const output = execSync(command, {
          encoding: 'utf-8',
          timeout: timeoutMs,
        });

        clearTimeout(timeout);

        // Parse JSON output
        const result = JSON.parse(output);
        resolve(result);
      } catch (error) {
        clearTimeout(timeout);
        if (error instanceof Error) {
          if (error.message.includes('timed out')) {
            reject(new Error('Grype execution timed out'));
          } else if (error.message.includes('ENOENT')) {
            reject(new Error('Grype CLI not found'));
          } else {
            reject(new Error(`Grype execution failed: ${error.message}`));
          }
        } else {
          reject(new Error('Grype execution failed'));
        }
      }
    } catch (error) {
      reject(error);
    }
  });
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
    if (!isGrypInstalled()) {
      throw new Error('Grype CLI is not installed');
    }

    // Generate SBOM
    const sbomContent = generateCycloneDxSbom(components);

    // Write SBOM to temp file (keep within repo, avoid OS temp dir)
    const scratchDir = resolve(process.cwd(), '.cache', 'grype');
    mkdirSync(scratchDir, { recursive: true });
    sbomPath = resolve(scratchDir, `sbom-${scanId}.json`);
    writeFileSync(sbomPath, sbomContent);

    console.log(`[Grype] Generated SBOM at ${sbomPath}`);

    // Execute Grype
    const startTime = Date.now();
    const grypOutput = await executeGrypeCli(sbomPath, timeoutMs);
    const durationMs = Date.now() - startTime;

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
    const message = error instanceof Error ? error.message : String(error);
    if (isGrypeMissingError(error)) {
      throw new Error(`Grype CLI is not installed: ${message}`);
    }

    console.error(`[Grype] Scan failed: ${message}`);
    throw error;
  } finally {
    // Cleanup temp file
    if (sbomPath && existsSync(sbomPath)) {
      try {
        unlinkSync(sbomPath);
        console.log(`[Grype] Cleaned up SBOM at ${sbomPath}`);
      } catch (cleanupError) {
        console.error(`[Grype] Failed to cleanup SBOM:`, cleanupError);
      }
    }
  }
}

/**
 * Check if Grype is installed
 */
export function isGrypInstalled(): boolean {
  try {
    execSync('which grype', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}
