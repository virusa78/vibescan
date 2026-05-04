/**
 * Syft Scanner Utility - SBOM Generation with CycloneDX Output
 * Syft generates Software Bill of Materials (SBOM) with component and vulnerability information
 */

import { execSync } from 'child_process';
import { writeFileSync, unlinkSync, existsSync, mkdirSync } from 'fs';
import { resolve } from 'path';
import { tmpdir } from 'os';
import type { NormalizedComponent } from '../../services/inputAdapterService.js';
import { normalizeSyftFindings } from '../../operations/scans/normalizeFindings.js';
import type { NormalizedFinding } from '../../operations/scans/normalizeFindings.js';

export interface SyftComponent {
  name: string;
  version: string;
  type: string;
  licenses?: Array<{ value: string }>;
}

export interface SyftVulnerability {
  id: string;
  description?: string;
  ratings?: Array<{
    severity: string;
    score: number;
  }>;
  fixes?: Array<{
    version: string;
  }>;
  ref?: string;
}

export interface SyftCycloneDxOutput {
  bomFormat: string;
  specVersion: string;
  version: number;
  components?: SyftComponent[];
  vulnerabilities?: SyftVulnerability[];
}

function isSyftMissingError(error: unknown): boolean {
  if (error && typeof error === 'object' && 'code' in error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') {
      return true;
    }
  }

  const message = error instanceof Error ? error.message : String(error);
  return /syft/i.test(message) && /(not found|enoent)/i.test(message);
}

export function isSyftInstalled(): boolean {
  try {
    execSync('syft --version', { stdio: 'pipe' });
    return true;
  } catch (error) {
    return !isSyftMissingError(error);
  }
}

/**
 * Execute Syft CLI and parse CycloneDX output
 */
export async function executeSyftCli(
  targetPath: string,
  timeoutMs: number = 300000 // 5 minutes - Syft is fast
): Promise<SyftCycloneDxOutput> {
  return new Promise((resolvePromise, rejectPromise) => {
    try {
      // Execute: syft <path> -o cyclonedx-json
      const command = `syft "${targetPath}" -o cyclonedx-json`;

      const timeout = setTimeout(() => {
        rejectPromise(new Error(`Syft execution timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      try {
        const output = execSync(command, {
          timeout: timeoutMs,
          encoding: 'utf-8',
          stdio: ['pipe', 'pipe', 'pipe'],
        });

        clearTimeout(timeout);

        // Parse the JSON output
        const parsed = JSON.parse(output);
        resolvePromise(parsed);
      } catch (error) {
        clearTimeout(timeout);

        if (error instanceof Error && error.message.includes('timed out')) {
          rejectPromise(error);
        } else {
          rejectPromise(
            new Error(
              `Failed to execute Syft: ${error instanceof Error ? error.message : String(error)}`
            )
          );
        }
      }
    } catch (error) {
      rejectPromise(
        new Error(
          `Syft execution error: ${error instanceof Error ? error.message : String(error)}`
        )
      );
    }
  });
}

export type SyftScanRun = {
  rawOutput: NormalizedFinding[];
  durationMs: number;
  syftVersion?: string;
};

/**
 * Scan with Syft SBOM generator
 */
export async function scanWithSyftDetailed(
  components: NormalizedComponent[],
  scanId: string
): Promise<SyftScanRun> {
  const startTime = Date.now();
  let tempDir: string | null = null;

  try {
    // Create temporary directory for scan
    tempDir = resolve(tmpdir(), `vibescan-syft-${scanId}`);
    if (!existsSync(tempDir)) {
      mkdirSync(tempDir, { recursive: true });
    }

    // Write normalized components to JSON for Syft scanning
    const componentFile = resolve(tempDir, 'components.json');
    writeFileSync(componentFile, JSON.stringify(components, null, 2), 'utf-8');

    // Run Syft on the directory
    const syftOutput = await executeSyftCli(tempDir);

    // Normalize Syft output to standard Finding format
    const findings = normalizeSyftFindings(syftOutput);

    // Get Syft version
    let syftVersion: string | undefined;
    try {
      syftVersion = execSync('syft --version', {
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
      syftVersion,
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
