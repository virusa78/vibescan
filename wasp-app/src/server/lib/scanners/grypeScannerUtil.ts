/**
 * Grype Scanner Utility - Executes Grype CLI and parses output
 * Grype is the free vulnerability scanner (Anchore)
 */

import { execSync, spawn } from 'child_process';
import { writeFileSync, unlinkSync, existsSync } from 'fs';
import { resolve } from 'path';
import type { NormalizedComponent } from '../../services/inputAdapterService';

export interface GrypeFinding {
  cveId: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  package: string;
  version: string;
  fixedVersion?: string;
  description: string;
  cvssScore: number;
  source: 'free';
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
): Promise<any> {
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
export function parseGrypOutput(rawOutput: any): GrypeFinding[] {
  if (!rawOutput || !rawOutput.matches || !Array.isArray(rawOutput.matches)) {
    return [];
  }

  const findings: GrypeFinding[] = [];

  for (const match of rawOutput.matches) {
    const vuln = match.vulnerability || {};
    const artifact = match.artifact || {};

    const finding: GrypeFinding = {
      cveId: vuln.id || 'UNKNOWN',
      severity: (vuln.severity || 'info').toLowerCase() as any,
      package: artifact.name || 'unknown',
      version: artifact.version || 'unknown',
      fixedVersion: vuln.fix?.versions?.[0],
      description: vuln.description || '',
      cvssScore: parseFloat(vuln.cvssScore?.baseScore || '0') || 0,
      source: 'free',
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
  let sbomPath: string | null = null;

  try {
    // Generate SBOM
    const sbomContent = generateCycloneDxSbom(components);

    // Write SBOM to temp file
    sbomPath = resolve(`/home/virus/vibescan/sbom-${scanId}.json`);
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

    return findings;
  } catch (error) {
    console.error(`[Grype] Scan failed:`, error);
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
