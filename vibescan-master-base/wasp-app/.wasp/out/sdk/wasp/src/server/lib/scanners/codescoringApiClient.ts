/**
 * Codescoring/Johnny Scanner - Handles enterprise vulnerability scanning via SSH.
 * The Johnny CLI on the remote machine handles the actual scanner logic and API communication.
 * Local configuration only requires SSH host, user, and private key.
 */

import { execFileSync } from 'child_process';
import { readFileSync, mkdirSync, rmSync } from 'fs';
import { resolve, join } from 'path';
import type { NormalizedComponent } from '../../services/inputAdapterService.js';
import { resolveTrustedScanInputPath } from '../../services/inputAdapterService.js';

export interface CodescoringFinding {
  cveId: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  package: string;
  version: string;
  fixedVersion?: string;
  description: string;
  cvssScore: number;
  source: 'codescoring_johnny';
}

export type CodescoringRawOutput = {
  bomFormat?: string;
  components?: CodescoringComponentRecord[];
  vulnerabilities?: CodescoringVulnerabilityRecord[];
};

export type CodescoringScanRun = {
  rawOutput: CodescoringRawOutput;
  findings: CodescoringFinding[];
  durationMs: number;
  scannerVersion: string;
};

type CodescoringComponentRecord = {
  ['bom-ref']?: string;
  bomRef?: string;
  purl?: string;
  name?: string;
  version?: string;
  vulnerabilities?: Array<{
    cveId?: string;
    severity?: string;
    cvssScore?: number | string;
    description?: string;
    fixedVersion?: string;
  }>;
};

type CodescoringVulnerabilityRecord = {
  id?: string;
  bomRef?: string;
  cveId?: string;
  severity?: string;
  packageName?: string;
  component?: string;
  version?: string;
  fixedVersion?: string;
  description?: string;
  cvssScore?: number | string;
  ratings?: Array<{
    severity?: string;
    score?: string | number;
  }>;
  affects?: Array<{
    ref?: string;
  }>;
  fixes?: Array<{
    version?: string;
  }>;
};

/**
 * SSH-based Codescoring client using 'johnny' utility
 */
class CodescoringSshClient {
  private host: string;
  private user: string;
  private keyPath: string;

  constructor(host: string, user: string, keyPath: string) {
    this.host = host;
    this.user = user;
    this.keyPath = keyPath;
  }

  private runSsh(command: string): string {
    const args = [
      '-o', 'BatchMode=yes',
      '-o', 'StrictHostKeyChecking=no',
      '-i', this.keyPath,
      `${this.user}@${this.host}`,
      command
    ];
    
    try {
      return execFileSync('ssh', args, { encoding: 'utf8', timeout: 300000 });
    } catch (error) {
      console.error(`[Codescoring-SSH] SSH command failed: ${command}`, error);
      throw new Error(`SSH execution failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private runScpToRemote(localPath: string, remotePath: string) {
    const args = [
      '-o', 'BatchMode=yes',
      '-o', 'StrictHostKeyChecking=no',
      '-i', this.keyPath,
      localPath,
      `${this.user}@${this.host}:${remotePath}`
    ];
    
    try {
      execFileSync('scp', args, { stdio: 'ignore', timeout: 60000 });
    } catch (error) {
      console.error(`[Codescoring-SSH] SCP to remote failed: ${localPath} -> ${remotePath}`, error);
      throw new Error(`SCP transfer failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private runScpFromRemote(remotePath: string, localPath: string) {
    const args = [
      '-o', 'BatchMode=yes',
      '-o', 'StrictHostKeyChecking=no',
      '-i', this.keyPath,
      `${this.user}@${this.host}:${remotePath}`,
      localPath
    ];
    
    try {
      execFileSync('scp', args, { stdio: 'ignore', timeout: 60000 });
    } catch (error) {
      console.error(`[Codescoring-SSH] SCP from remote failed: ${remotePath} -> ${localPath}`, error);
      throw new Error(`SCP transfer failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async scan(scanId: string, input: { inputType: string; inputRef: string }): Promise<CodescoringRawOutput> {
    const { inputType, inputRef } = input;
    console.log(`[Codescoring-SSH] Starting remote scan ${scanId} (type: ${inputType})`);

    // 1. Create remote temp directory
    const remoteTempDir = this.runSsh('mktemp -d').trim();
    console.log(`[Codescoring-SSH] Created remote temp dir: ${remoteTempDir}`);

    try {
      const remoteOutputFile = `${remoteTempDir}/result.json`;
      const remoteScriptPath = `${remoteTempDir}/scan.sh`;
      
      // 2. Deliver the scan script to remote
      const localScriptPath = resolve(process.cwd(), 'src', 'server', 'scripts', 'codescoring-remote-scan.sh');
      console.log(`[Codescoring-SSH] Delivering scan script: ${localScriptPath} -> ${remoteScriptPath}`);
      this.runScpToRemote(localScriptPath, remoteScriptPath);

      // 3. Prepare remote input
      if (inputType === 'source_zip') {
        const localZipPath = resolveTrustedScanInputPath(inputRef);
        const remoteZipPath = `${remoteTempDir}/source.zip`;
        console.log(`[Codescoring-SSH] Uploading ZIP to remote: ${localZipPath}`);
        this.runScpToRemote(localZipPath, remoteZipPath);
      } else if (inputType === 'sbom') {
        const localSbomPath = resolveTrustedScanInputPath(inputRef);
        const remoteSbomPath = `${remoteTempDir}/sbom.json`;
        console.log(`[Codescoring-SSH] Uploading SBOM to remote: ${localSbomPath}`);
        this.runScpToRemote(localSbomPath, remoteSbomPath);
      } else if (inputType !== 'github') {
        throw new Error(`Unsupported input type for Codescoring-SSH: ${inputType}`);
      }

      // 4. Run the scan script on remote via SSH
      console.log(`[Codescoring-SSH] Executing remote scan script...`);
      this.runSsh(`bash "${remoteScriptPath}" "${inputType}" "${inputRef}" "${remoteOutputFile}"`);

      // 5. Download results via SCP
      const localResultDir = resolve(process.cwd(), '.cache', 'codescoring');
      mkdirSync(localResultDir, { recursive: true });
      const localResultPath = join(localResultDir, `result-${scanId}.json`);
      
      console.log(`[Codescoring-SSH] Downloading results to ${localResultPath}`);
      this.runScpFromRemote(remoteOutputFile, localResultPath);

      // 4. Read and parse results
      const resultJson = readFileSync(localResultPath, 'utf8');
      const result = JSON.parse(resultJson);

      // Clean up local cache
      try {
        rmSync(localResultPath);
      } catch {
        console.warn(`[Codescoring-SSH] Failed to cleanup local result file: ${localResultPath}`);
      }

      return result;
    } finally {
      // 5. Remote Cleanup
      console.log(`[Codescoring-SSH] Cleaning up remote temp dir: ${remoteTempDir}`);
      this.runSsh(`rm -rf "${remoteTempDir}"`);
    }
  }
}

/**
 * Generate mock Codescoring findings for MVP testing
 */
function generateMockFindings(components: NormalizedComponent[]): CodescoringFinding[] {
  const mockVulnerabilities: Record<string, CodescoringFinding[]> = {
    'lodash': [
      {
        cveId: 'CVE-2024-5678',
        severity: 'critical',
        package: 'lodash',
        version: '1.0.0',
        fixedVersion: '1.0.2',
        description: 'Enterprise vulnerability in lodash',
        cvssScore: 9.2,
        source: 'codescoring_johnny',
      },
    ],
    'express': [
      {
        cveId: 'CVE-2024-1111',
        severity: 'high',
        package: 'express',
        version: '4.0.0',
        fixedVersion: '4.18.0',
        description: 'Express authentication bypass',
        cvssScore: 8.1,
        source: 'codescoring_johnny',
      },
    ],
  };

  const findings: CodescoringFinding[] = [];
  for (const component of components) {
    const vulns = mockVulnerabilities[component.name] || [];
    findings.push(...vulns);
  }

  return findings;
}

/**
 * Parse scan response into normalized findings
 */
function parseCodescoringResponse(apiResponse: CodescoringRawOutput): CodescoringFinding[] {
  if (!apiResponse) {
    return [];
  }

  const findings: CodescoringFinding[] = [];

  // 1. Handle CycloneDX format (produced by Johnny CLI)
  if (apiResponse.bomFormat === 'CycloneDX') {
    const componentsMap = new Map<string, CodescoringComponentRecord>();
    
    if (Array.isArray(apiResponse.components)) {
      for (const comp of apiResponse.components) {
        const ref = comp['bom-ref'] || comp.bomRef || comp.purl;
        if (ref) {
          componentsMap.set(ref, comp);
        }
      }
    }

    if (Array.isArray(apiResponse.vulnerabilities)) {
      for (const vuln of apiResponse.vulnerabilities) {
        const affects = Array.isArray(vuln.affects) ? vuln.affects : [];
        const rating = Array.isArray(vuln.ratings) ? vuln.ratings[0] : null;
        
        for (const affect of affects) {
          const ref = affect.ref || '';
          const comp = componentsMap.get(ref);
          
          findings.push({
            cveId: vuln.id || vuln.bomRef || 'UNKNOWN',
            severity: (rating?.severity || 'info').toLowerCase() as CodescoringFinding['severity'],
            package: comp?.name || 'unknown',
            version: comp?.version || 'unknown',
            fixedVersion: Array.isArray(vuln.fixes) ? vuln.fixes[0]?.version : undefined,
            description: vuln.description || '',
            cvssScore: Number.parseFloat(String(rating?.score ?? '0')) || 0,
            source: 'codescoring_johnny',
          });
        }
      }
    }
    return findings;
  }

  // 2. Handle Legacy API format
  if (Array.isArray(apiResponse.vulnerabilities)) {
    for (const vuln of apiResponse.vulnerabilities) {
      findings.push({
        cveId: vuln.cveId || vuln.id || 'UNKNOWN',
        severity: (vuln.severity || 'info').toLowerCase() as CodescoringFinding['severity'],
        package: vuln.packageName || vuln.component || 'unknown',
        version: vuln.version || 'unknown',
        fixedVersion: vuln.fixedVersion,
        description: vuln.description || '',
        cvssScore: Number.parseFloat(String(vuln.cvssScore ?? '0')) || 0,
        source: 'codescoring_johnny',
      });
    }
  }

  return findings;
}

/**
 * Main function: Scan components with Codescoring (SSH mode with Johnny CLI)
 * Falls back to mock if SSH not configured
 * @param components Normalized components to scan
 * @param scanId Unique scan ID
 * @param input Input details (inputType, inputRef)
 * @returns Array of vulnerabilities found
 */
export async function scanWithCodescoring(
  components: NormalizedComponent[],
  scanId: string,
  input?: { inputType: string; inputRef: string }
): Promise<CodescoringFinding[]> {
  const run = await scanWithCodescoringDetailed(components, scanId, input);
  return run.findings;
}

export async function scanWithCodescoringDetailed(
  components: NormalizedComponent[],
  scanId: string,
  input?: { inputType: string; inputRef: string }
): Promise<CodescoringScanRun> {
  const host = process.env.CODESCORING_SSH_HOST;
  const user = process.env.CODESCORING_SSH_USER;
  const keyPath = process.env.CODESCORING_SSH_KEY_PATH;

  // Use mock mode if SSH not configured
  if (!host || !user || !keyPath || !input) {
    console.log('[Codescoring] Using mock Codescoring results (SSH details or scan input missing)');
    const findings = generateMockFindings(components);
    const rawOutput = {
      components: components.map((component) => ({
        name: component.name,
        version: component.version,
        vulnerabilities: findings
          .filter((finding) => finding.package === component.name && finding.version === component.version)
          .map((finding) => ({
            cveId: finding.cveId,
            severity: finding.severity,
            cvssScore: finding.cvssScore,
            description: finding.description,
            fixedVersion: finding.fixedVersion,
          })),
      })),
    } satisfies CodescoringRawOutput;

    return {
      rawOutput,
      findings,
      durationMs: 0,
      scannerVersion: 'codescoring-mock',
    };
  }

  try {
    const startTime = Date.now();
    const client = new CodescoringSshClient(host, user, keyPath);
    const rawResult = await client.scan(scanId, input);
    const durationMs = Date.now() - startTime;
    
    // Parse scan findings from johnny output (CycloneDX format)
    const findings = parseCodescoringResponse(rawResult);
    console.log(`[Codescoring] Found ${findings.length} vulnerabilities from Johnny`);

    return {
      rawOutput: rawResult,
      findings,
      durationMs,
      scannerVersion: 'codescoring-johnny',
    };
  } catch (error) {
    console.error('[Codescoring-SSH] Remote scan failed:', error);
    throw error;
  }
}

/**
 * Check if Codescoring SSH is configured
 */
export function isCodescoringConfigured(): boolean {
  return !!(process.env.CODESCORING_SSH_HOST && process.env.CODESCORING_SSH_USER && process.env.CODESCORING_SSH_KEY_PATH);
}
