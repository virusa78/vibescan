/**
 * Syft Scanner Utility - SBOM Generation with CycloneDX Output
 * Syft generates Software Bill of Materials (SBOM) with component and vulnerability information
 */

import { exec, execFile } from 'child_process';
import { promisify } from 'util';
import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { rm } from 'fs/promises';
import { resolve } from 'path';
import { tmpdir } from 'os';
import type { NormalizedComponent } from '../../services/inputAdapterService.js';
import { normalizeTrivyFindings, type NormalizedFinding } from '../../operations/scans/normalizeFindings.js';

const execPromise = promisify(exec);
const execFilePromise = promisify(execFile);

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

export async function isSyftInstalled(): Promise<boolean> {
  try {
    await execPromise('syft --version');
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
  // Execute: syft <path> -o cyclonedx-json
  try {
    const { stdout } = await execFilePromise('syft', [targetPath, '-o', 'cyclonedx-json'], {
      timeout: timeoutMs,
      maxBuffer: 20 * 1024 * 1024,
    });
    return JSON.parse(stdout);
  } catch (error) {
    if (error instanceof Error && error.message.includes('timed out')) {
      throw error;
    } else {
      throw new Error(
        `Failed to execute Syft: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
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
    const findings = normalizeTrivyFindings(syftOutput);

    // Get Syft version
    let syftVersion: string | undefined;
    try {
      const versionOutput = await execPromise('syft --version');
      syftVersion = versionOutput.stdout
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
        await rm(tempDir, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors
      }
    }
  }
}
