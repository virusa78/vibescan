import { exec } from 'child_process';
import { promisify } from 'util';
import { existsSync, mkdirSync, unlinkSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import type { NormalizedComponent } from '../../services/inputAdapterService.js';
import { generateCycloneDxSbom } from './grypeScannerUtil.js';
import { normalizeTrivyFindings, type NormalizedFinding } from '../../operations/scans/normalizeFindings.js';
import { runTrivySbomScan } from './scannerRuntime.js';

const execPromise = promisify(exec);

export type TrivyScanRun = {
  rawOutput: unknown;
  findings: NormalizedFinding[];
  durationMs: number;
  trivyVersion?: string;
};

export async function isTrivyInstalled(): Promise<boolean> {
  try {
    await execPromise('trivy --version');
    return true;
  } catch {
    return false;
  }
}

export async function scanWithTrivyDetailed(
  components: NormalizedComponent[],
  scanId: string,
): Promise<TrivyScanRun> {
  const startTime = Date.now();
  const scratchDir = resolve(process.cwd(), '.cache', 'trivy');
  let sbomPath: string | null = null;

  try {
    if (!existsSync(scratchDir)) {
      mkdirSync(scratchDir, { recursive: true });
    }

    sbomPath = resolve(scratchDir, `sbom-${scanId}.json`);
    writeFileSync(sbomPath, generateCycloneDxSbom(components), 'utf-8');

    const output = await runTrivySbomScan(sbomPath, 600000);
    const parsed = JSON.parse(output) as unknown;
    const findings = normalizeTrivyFindings(parsed);

    let trivyVersion: string | undefined;
    try {
      const versionOutput = await execPromise('trivy --version');
      trivyVersion = versionOutput.stdout
        .trim()
        .match(/(\d+\.\d+\.\d+)/)?.[1];
    } catch {
      // Version detection is best-effort.
    }

    return {
      rawOutput: parsed,
      findings,
      durationMs: Date.now() - startTime,
      trivyVersion,
    };
  } finally {
    if (sbomPath && existsSync(sbomPath)) {
      try {
        unlinkSync(sbomPath);
      } catch {
        // Ignore cleanup failures.
      }
    }
  }
}
