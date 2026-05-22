import { normalizeCodescoringFindings } from '../../operations/scans/normalizeFindings.js';
import { isCodescoringConfigured, scanWithCodescoringDetailed, } from './codescoringApiClient.js';
async function getCodescoringHealth() {
    const configured = isCodescoringConfigured();
    return {
        configured,
        healthy: configured ? true : null,
        message: configured ? null : 'Codescoring SSH is not configured; mock mode will be used',
    };
}
export const codescoringProvider = {
    kind: 'codescoring-johnny',
    displayName: 'Codescoring Johnny',
    supportsUserSecrets: false,
    async getHealth() {
        return getCodescoringHealth();
    },
    async scanComponents(components, context) {
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
//# sourceMappingURL=codescoringProvider.js.map