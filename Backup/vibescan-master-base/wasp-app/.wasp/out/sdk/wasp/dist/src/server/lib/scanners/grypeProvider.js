import { normalizeGrypeFindings } from '../../operations/scans/normalizeFindings.js';
import { isGrypInstalled, scanWithGrypeDetailed, } from './grypeScannerUtil.js';
async function getGrypeHealth() {
    const configured = isGrypInstalled();
    return {
        configured,
        healthy: configured,
        message: configured ? null : 'Grype CLI is not installed',
    };
}
export const grypeProvider = {
    kind: 'grype',
    displayName: 'Grype',
    supportsUserSecrets: false,
    async getHealth() {
        return getGrypeHealth();
    },
    async scanComponents(components, context) {
        const run = await scanWithGrypeDetailed(components, context.scanId);
        return {
            provider: 'grype',
            rawOutput: run.rawOutput,
            findings: normalizeGrypeFindings(run.rawOutput),
            durationMs: run.durationMs,
        };
    },
};
//# sourceMappingURL=grypeProvider.js.map