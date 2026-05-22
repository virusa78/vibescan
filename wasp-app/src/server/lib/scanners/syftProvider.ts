import type { ScannerExecutionContext, ScannerProvider, ScannerScanResult } from './providerTypes.js';
import type { NormalizedComponent } from '../../services/inputAdapterService.js';
import { isTrivyInstalled, scanWithTrivyDetailed } from './trivyScannerUtil.js';

export const syftProvider: ScannerProvider = {
  kind: 'trivy',
  displayName: 'Trivy',
  supportsUserSecrets: false,

  async getHealth(): Promise<{ configured: boolean; healthy: boolean | null; message?: string }> {
    const trivyInstalled = isTrivyInstalled();
    return {
      configured: trivyInstalled,
      healthy: trivyInstalled ? true : false,
      message: trivyInstalled ? 'Trivy is installed and ready' : 'Trivy CLI not found',
    };
  },

  async scanComponents(
    components: NormalizedComponent[],
    context: ScannerExecutionContext
  ): Promise<ScannerScanResult> {
    const { rawOutput, findings, durationMs, trivyVersion } = await scanWithTrivyDetailed(components, context.scanId);

    return {
      provider: 'trivy',
      rawOutput,
      findings,
      durationMs,
      scannerVersion: trivyVersion,
    };
  },
};
