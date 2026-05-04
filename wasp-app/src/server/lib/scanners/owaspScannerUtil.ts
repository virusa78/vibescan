/**
 * OWASP Dependency-Check Scanner Utility - Executes Dependency-Check CLI
 * OWASP Dependency-Check identifies known vulnerable components in dependencies
 */

import { execSync } from 'child_process';
import { writeFileSync, unlinkSync, existsSync, mkdirSync } from 'fs';
import { resolve } from 'path';
import { tmpdir } from 'os';
import type { NormalizedComponent } from '../../services/inputAdapterService.js';
import { normalizeOwaspFindings } from '../../operations/scans/normalizeFindings.js';
import type { NormalizedFinding } from '../../operations/scans/normalizeFindings.js';

export interface OwaspVulnerability {
  name: string;
  version: string;
  cve: string;
  cvssScore: number;
  severity: string;
  description: string;
  source: 'owasp';
}

export type OwaspScanResult = {
  reportVersion: string;
  appName: string;
  appVersion?: string;
  reportDate: string;
  vulnerabilities: OwaspVulnerability[];
};

function isOwaspMissingError(error: unknown): boolean {
  if (error && typeof error === 'object' && 'code' in error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') {
      return true;
    }
  }

  const message = error instanceof Error ? error.message : String(error);
  return /dependency-check/i.test(message) && /(not found|enoent)/i.test(message);
}

export function isOwaspInstalled(): boolean {
  try {
    execSync('dependency-check --version', { stdio: 'pipe' });
    return true;
  } catch (error) {
    return !isOwaspMissingError(error);
  }
}

/**
 * Execute OWASP Dependency-Check and parse JSON output
 */
export async function executeOwaspCli(
  targetPath: string,
  projectName: string,
  timeoutMs: number = 600000 // 10 minutes - Dependency-Check can be slow
): Promise<OwaspScanResult> {
  return new Promise((resolvePromise, rejectPromise) => {
    try {
      const reportDir = resolve(tmpdir(), `vibescan-owasp-${Date.now()}`);
      mkdirSync(reportDir, { recursive: true });

      // Execute: dependency-check --project "name" --scan <path> --format JSON --out <report-dir>
      const command = `dependency-check --project "${projectName}" --scan "${targetPath}" --format JSON --out "${reportDir}"`;

      const timeout = setTimeout(() => {
        rejectPromise(new Error(`OWASP execution timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      try {
        execSync(command, {
          timeout: timeoutMs,
          stdio: ['pipe', 'pipe', 'pipe'],
        });

        clearTimeout(timeout);

        // Parse the generated JSON report
        const reportPath = resolve(reportDir, 'dependency-check-report.json');
        if (!existsSync(reportPath)) {
          throw new Error('OWASP report not generated');
        }

        const reportContent = execSync(`cat "${reportPath}"`, {
          encoding: 'utf-8',
        });
        const parsed = JSON.parse(reportContent);

        // Cleanup
        try {
          execSync(`rm -rf "${reportDir}"`);
        } catch {
          // Ignore cleanup errors
        }

        resolvePromise(parsed);
      } catch (error) {
        clearTimeout(timeout);
        // Cleanup on error
        try {
          execSync(`rm -rf "${reportDir}"`);
        } catch {
          // Ignore cleanup errors
        }

        if (error instanceof Error && error.message.includes('timed out')) {
          rejectPromise(error);
        } else {
          rejectPromise(
            new Error(
              `Failed to execute OWASP: ${error instanceof Error ? error.message : String(error)}`
            )
          );
        }
      }
    } catch (error) {
      rejectPromise(
        new Error(
          `OWASP execution error: ${error instanceof Error ? error.message : String(error)}`
        )
      );
    }
  });
}

export type OwaspScanRun = {
  rawOutput: NormalizedFinding[];
  durationMs: number;
  owaspVersion?: string;
};

/**
 * Scan with OWASP Dependency-Check
 */
export async function scanWithOwaspDetailed(
  components: NormalizedComponent[],
  scanId: string
): Promise<OwaspScanRun> {
  const startTime = Date.now();
  let tempDir: string | null = null;

  try {
    // Create temporary directory for scan
    tempDir = resolve(tmpdir(), `vibescan-owasp-${scanId}`);
    if (!existsSync(tempDir)) {
      mkdirSync(tempDir, { recursive: true });
    }

    // For now, scan the temp directory itself as placeholder
    // In production, you'd extract actual dependency files here
    const owaspOutput = await executeOwaspCli(
      tempDir,
      `VibeScan-${scanId}`
    );

    // Normalize OWASP output to standard Finding format
    const findings = normalizeOwaspFindings(owaspOutput);

    // Get OWASP version
    let owaspVersion: string | undefined;
    try {
      owaspVersion = execSync('dependency-check --version', {
        encoding: 'utf-8',
      })
        .trim()
        .match(/(\d+\.\d+\.\d+)/)?.[1];
    } catch {
      // Version detection failure is non-fatal
    }

    return {
      rawOutput: findings,
      durationMs: Date.now() - startTime,
      owaspVersion,
    };
  } finally {
    // Cleanup
    if (tempDir && existsSync(tempDir)) {
      try {
        execSync(`rm -rf "${tempDir}"`);
      } catch {
        // Ignore cleanup errors
      }
    }
  }
}
