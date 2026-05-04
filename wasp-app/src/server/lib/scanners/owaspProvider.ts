/**
 * OWASP Dependency-Check Scanner Provider
 * OWASP Dependency-Check identifies known vulnerable components in dependencies
 */

import type { ScannerExecutionContext, ScannerProvider, ScannerScanResult } from './providerTypes.js';
import type { NormalizedComponent } from '../../services/inputAdapterService.js';
import { scanWithOwaspDetailed } from './owaspScannerUtil.js';

export const owaspProvider: ScannerProvider = {
  kind: 'owasp',
  displayName: 'OWASP Dependency-Check',
  supportsUserSecrets: false,

  async getHealth(): Promise<{ configured: boolean; healthy: boolean | null; message?: string }> {
    const isOwaspInstalled = await checkOwaspInstalled();
    return {
      configured: isOwaspInstalled,
      healthy: isOwaspInstalled ? true : false,
      message: isOwaspInstalled ? 'OWASP Dependency-Check is installed' : 'Dependency-Check CLI not found',
    };
  },

  async scanComponents(
    components: NormalizedComponent[],
    context: ScannerExecutionContext
  ): Promise<ScannerScanResult> {
    const { rawOutput, durationMs, owaspVersion } = await scanWithOwaspDetailed(components, context.scanId);

    return {
      provider: 'owasp',
      rawOutput,
      findings: rawOutput, // Already normalized by owaspScannerUtil
      durationMs,
      scannerVersion: owaspVersion,
    };
  },
};

async function checkOwaspInstalled(): Promise<boolean> {
  try {
    const { execSync } = await import('child_process');
    execSync('dependency-check --version', { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}
