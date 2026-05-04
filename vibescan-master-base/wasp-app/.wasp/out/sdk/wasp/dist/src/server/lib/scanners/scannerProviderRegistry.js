import { codescoringProvider } from './codescoringProvider.js';
import { grypeProvider } from './grypeProvider.js';
import { snykProvider } from './snykProvider.js';
const scannerProviders = {
    grype: grypeProvider,
    'codescoring-johnny': codescoringProvider,
    snyk: snykProvider,
};
export function getScannerProvider(kind) {
    const provider = scannerProviders[kind];
    if (!provider) {
        throw new Error(`Scanner provider is not registered: ${kind}`);
    }
    return provider;
}
export function listScannerProviders() {
    return Object.values(scannerProviders).filter((provider) => provider !== undefined);
}
//# sourceMappingURL=scannerProviderRegistry.js.map