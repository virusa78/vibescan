import { normalizeCodescoringFindings } from '../../operations/scans/normalizeFindings.js';
import {
  isCodescoringConfigured,
  scanWithCodescoringDetailed,
} from './codescoringApiClient.js';
import type {
  ScannerHealthState,
  ScannerProvider,
  ScannerScanResult,
} from './providerTypes.js';

async function getCodescoringHealth(): Promise<ScannerHealthState> {
  const configured = isCodescoringConfigured();
  return {
    configured,
    healthy: configured ? true : null,
    message: configured ? null : 'Codescoring SSH is not configured; mock mode will be used',
  };
}

export const codescoringProvider: ScannerProvider = {
  kind: 'codescoring-johnny',
  displayName: 'Codescoring Johnny',
  supportsUserSecrets: false,
  async getHealth() {
    return getCodescoringHealth();
  },
  async scanComponents(components, context): Promise<ScannerScanResult> {
    const run = await scanWithCodescoringDetailed(components, context.scanId, {
      inputType: context.inputType,
      inputRef: context.inputRef,
    });

    return {
      provider: 'codescoring-johnny',
      rawOutput: run.rawOutput,
      findings: normalizeCodescoringFindings(run.rawOutput),
      durationMs: run.durationMs,
      scannerVersion: run.scannerVersion,
    };
  },
};
