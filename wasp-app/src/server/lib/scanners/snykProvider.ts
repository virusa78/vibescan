import { getScannerHealthSnapshot } from '../../services/scannerHealthMonitor.js';
import {
  runSnykScan,
} from './snykRuntime.js';
import type {
  ScannerHealthState,
  ScannerExecutionContext,
  ScannerProvider,
  ScannerScanResult,
} from './providerTypes.js';

async function getSnykHealth(context?: Partial<ScannerExecutionContext>): Promise<ScannerHealthState> {
  const snapshot = getScannerHealthSnapshot().snyk;
  const contextToken = context?.resolvedCredentials?.values.token?.trim();
  const hasToken = !!(contextToken || process.env.SNYK_TOKEN?.trim());

  return {
    configured: snapshot.configured || hasToken,
    healthy: snapshot.healthy ?? (hasToken ? true : null),
    message: snapshot.error || (hasToken ? null : 'Snyk token or SSH runtime is not configured'),
  };
}

export const snykProvider: ScannerProvider = {
  kind: 'snyk',
  displayName: 'Snyk',
  supportsUserSecrets: true,
  async getHealth(context) {
    return getSnykHealth(context);
  },
  async scanComponents(components, context): Promise<ScannerScanResult> {
    const run = await runSnykScan(
      components,
      context.scanId,
      context.resolvedCredentials,
    );

    return {
      provider: 'snyk',
      rawOutput: run.rawOutput,
      findings: run.findings,
      durationMs: run.durationMs,
      scannerVersion: run.scannerVersion,
    };
  },
};
