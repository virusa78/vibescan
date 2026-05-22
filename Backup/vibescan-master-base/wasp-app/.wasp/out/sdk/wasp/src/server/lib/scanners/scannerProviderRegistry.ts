import { codescoringProvider } from './codescoringProvider.js';
import { grypeProvider } from './grypeProvider.js';
import { snykProvider } from './snykProvider.js';
import type { ScannerProvider, ScannerProviderKind } from './providerTypes.js';

const scannerProviders: Record<ScannerProviderKind, ScannerProvider | undefined> = {
  grype: grypeProvider,
  'codescoring-johnny': codescoringProvider,
  snyk: snykProvider,
};

export function getScannerProvider(kind: ScannerProviderKind): ScannerProvider {
  const provider = scannerProviders[kind];
  if (!provider) {
    throw new Error(`Scanner provider is not registered: ${kind}`);
  }

  return provider;
}

export function listScannerProviders(): ScannerProvider[] {
  return Object.values(scannerProviders).filter(
    (provider): provider is ScannerProvider => provider !== undefined,
  );
}
