/**
 * Syft Scanner Provider - SBOM Generation
 * Syft is a fast, accurate SBOM generator for identifying components and their known vulnerabilities
 */

import type { ScannerExecutionContext, ScannerProvider, ScannerScanResult } from './providerTypes.js';
import type { NormalizedComponent } from '../../services/inputAdapterService.js';
import { scanWithSyftDetailed } from './syftScannerUtil.js';

export const syftProvider: ScannerProvider = {
  kind: 'syft',
  displayName: 'Syft (SBOM)',
  supportsUserSecrets: false,

  async getHealth(): Promise<{ configured: boolean; healthy: boolean | null; message?: string }> {
    const isSyftInstalled = await checkSyftInstalled();
    return {
      configured: isSyftInstalled,
      healthy: isSyftInstalled ? true : false,
      message: isSyftInstalled ? 'Syft is installed and ready' : 'Syft CLI not found',
    };
  },

  async scanComponents(
    components: NormalizedComponent[],
    context: ScannerExecutionContext
  ): Promise<ScannerScanResult> {
    const { rawOutput, durationMs, syftVersion } = await scanWithSyftDetailed(components, context.scanId);

    return {
      provider: 'syft',
      rawOutput,
      findings: rawOutput, // Already normalized by syftScannerUtil
      durationMs,
      scannerVersion: syftVersion,
    };
  },
};

async function checkSyftInstalled(): Promise<boolean> {
  try {
    const { execSync } = await import('child_process');
    execSync('syft --version', { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}
