import { normalizeGrypeFindings } from '../../operations/scans/normalizeFindings.js';
import {
  isGrypInstalled,
  scanWithGrypeDetailed,
} from './grypeScannerUtil.js';
import type {
  ScannerHealthState,
  ScannerProvider,
  ScannerScanResult,
} from './providerTypes.js';

async function getGrypeHealth(): Promise<ScannerHealthState> {
  const configured = isGrypInstalled();
  return {
    configured,
    healthy: configured,
    message: configured ? null : 'Grype CLI is not installed',
  };
}

export const grypeProvider: ScannerProvider = {
  kind: 'grype',
  displayName: 'Grype',
  supportsUserSecrets: false,
  async getHealth() {
    return getGrypeHealth();
  },
  async scanComponents(components, context): Promise<ScannerScanResult> {
    const run = await scanWithGrypeDetailed(components, context.scanId);

    return {
      provider: 'grype',
      rawOutput: run.rawOutput,
      findings: normalizeGrypeFindings(run.rawOutput),
      durationMs: run.durationMs,
    };
  },
};
