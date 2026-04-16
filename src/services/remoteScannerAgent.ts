import {
    NormalizedProviderResult,
    NormalizedScenarioRequest,
    ProviderRequestPayload,
    ProviderSelection,
    RemoteScannerEngine,
    RemoteScannerProvider,
    RemoteScannerProviderId,
    ScenarioInput,
} from '../types/remoteScanner.js';
import { grypeLikeRemoteProvider } from './scanners/grypeLikeRemoteProvider.js';

const DEFAULT_PROVIDER_BY_ENGINE: Record<RemoteScannerEngine, RemoteScannerProviderId> = {
    free: 'grype_like',
    grype_like: 'grype_like',
};

export class RemoteScannerAgent {
    private providers = new Map<RemoteScannerProviderId, RemoteScannerProvider>();

    constructor() {
        this.registerProvider(grypeLikeRemoteProvider);
    }

    registerProvider(provider: RemoteScannerProvider): void {
        this.providers.set(provider.id, provider);
    }

    normalizeScenarioRequest(input: ScenarioInput): NormalizedScenarioRequest {
        switch (input.scenario) {
            case 'github_app': {
                if (!input.repo) {
                    throw { code: 'validation_error', message: 'github_app requires repo' };
                }

                const ref = input.ref || 'HEAD';
                return {
                    scenario: 'github_app',
                    inputRef: input.inputRef || `${input.repo}@${ref}`,
                    github: {
                        repo: input.repo,
                        ref,
                    },
                };
            }
            case 'source_zip': {
                if (!input.s3Key) {
                    throw { code: 'validation_error', message: 'source_zip requires s3Key' };
                }

                return {
                    scenario: 'source_zip',
                    inputRef: input.inputRef || input.s3Key,
                    sourceZip: {
                        s3Key: input.s3Key,
                    },
                };
            }
            case 'sbom_upload': {
                if (!input.sbomRaw && !input.sbomS3Key) {
                    throw { code: 'validation_error', message: 'sbom_upload requires sbomRaw or sbomS3Key' };
                }

                return {
                    scenario: 'sbom_upload',
                    inputRef: input.inputRef || input.sbomS3Key || 'inline-sbom',
                    sbom: {
                        raw: input.sbomRaw,
                        s3Key: input.sbomS3Key,
                    },
                };
            }
            default:
                throw { code: 'validation_error', message: `Unsupported scenario: ${(input as any).scenario}` };
        }
    }

    selectProvider(engine: RemoteScannerEngine, providerOverride?: RemoteScannerProviderId): ProviderSelection {
        if (providerOverride) {
            return { engine, provider: providerOverride };
        }

        const provider = DEFAULT_PROVIDER_BY_ENGINE[engine];
        if (!provider) {
            throw { code: 'validation_error', message: `No provider configured for engine: ${engine}` };
        }

        return { engine, provider };
    }

    toProviderPayload(
        scenarioRequest: NormalizedScenarioRequest,
        selection: ProviderSelection,
    ): ProviderRequestPayload {
        switch (scenarioRequest.scenario) {
            case 'github_app':
                return {
                    provider: selection.provider,
                    engine: selection.engine,
                    inputRef: scenarioRequest.inputRef,
                    target: {
                        type: 'github_repo',
                        repo: scenarioRequest.github.repo,
                        ref: scenarioRequest.github.ref,
                    },
                };
            case 'source_zip':
                return {
                    provider: selection.provider,
                    engine: selection.engine,
                    inputRef: scenarioRequest.inputRef,
                    target: {
                        type: 'source_zip',
                        s3Key: scenarioRequest.sourceZip.s3Key,
                    },
                };
            case 'sbom_upload':
                return {
                    provider: selection.provider,
                    engine: selection.engine,
                    inputRef: scenarioRequest.inputRef,
                    target: {
                        type: 'sbom',
                        s3Key: scenarioRequest.sbom.s3Key,
                        sbomRaw: scenarioRequest.sbom.raw,
                    },
                };
            default:
                throw { code: 'validation_error', message: `Unsupported scenario: ${(scenarioRequest as any).scenario}` };
        }
    }

    async executeScenario(
        input: ScenarioInput,
        engine: RemoteScannerEngine = 'grype_like',
        providerOverride?: RemoteScannerProviderId,
        source: 'free' | 'enterprise' = 'free',
    ): Promise<NormalizedProviderResult> {
        const scenarioRequest = this.normalizeScenarioRequest(input);
        const selection = this.selectProvider(engine, providerOverride);
        const payload = this.toProviderPayload(scenarioRequest, selection);
        const provider = this.providers.get(selection.provider);

        if (!provider) {
            throw {
                code: 'remote_scanner_provider_not_found',
                message: `No remote scanner provider registered for: ${selection.provider}`,
            };
        }

        const rawResponse = await provider.execute(payload);
        return this.normalizeProviderResult(rawResponse, source);
    }

    normalizeProviderResult(rawResponse: any, source: 'free' | 'enterprise' = 'free'): NormalizedProviderResult {
        const rawOutput = rawResponse?.rawOutput || rawResponse || {};
        const matches = rawOutput.matches || [];

        const vulnerabilities = matches.map((match: any) => {
            const vulnerability = match.vulnerability || {};
            const artifact = match.artifact || {};

            return {
                cve_id: vulnerability.id || 'UNKNOWN',
                severity: this.mapSeverity(vulnerability.severity),
                cvss_score: this.extractCvssScore(vulnerability),
                package_name: artifact.name || '',
                package_ecosystem: this.determineEcosystem(artifact),
                installed_version: artifact.version || '',
                fixed_version: this.extractFixedVersion(vulnerability),
                purl: artifact.purl || '',
                epss_score: null,
                is_exploitable: false,
                description: vulnerability.description || '',
                references: this.extractReferences(vulnerability),
                source,
            };
        });

        return {
            scanId: rawResponse?.scanId || '',
            source,
            rawOutput,
            vulnerabilities,
            scannerVersion: rawResponse?.scannerVersion || rawOutput?.descriptor?.version || 'grype-unknown',
            cveDbTimestamp: rawResponse?.cveDbTimestamp || new Date().toISOString(),
            durationMs: rawResponse?.durationMs || 0,
        };
    }

    private mapSeverity(severity: string): 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' {
        const map: Record<string, 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'> = {
            critical: 'CRITICAL',
            high: 'HIGH',
            medium: 'MEDIUM',
            low: 'LOW',
            negligible: 'LOW',
            unknown: 'LOW',
        };

        return map[(severity || '').toLowerCase()] || 'LOW';
    }

    private extractCvssScore(vulnerability: any): number {
        if (!vulnerability?.cvss) {
            return 0;
        }

        if (Array.isArray(vulnerability.cvss)) {
            return vulnerability.cvss[0]?.score || 0;
        }

        return vulnerability.cvss.score || 0;
    }

    private extractFixedVersion(vulnerability: any): string | null {
        if (!vulnerability?.fix) {
            return null;
        }

        if (Array.isArray(vulnerability.fix)) {
            return vulnerability.fix[0]?.versions?.[0] || null;
        }

        return vulnerability.fix.versions?.[0] || null;
    }

    private extractReferences(vulnerability: any): string[] {
        const references = vulnerability?.references || [];
        return references.map((ref: any) => ref?.url).filter(Boolean);
    }

    private determineEcosystem(artifact: any): 'npm' | 'pypi' | 'maven' | 'cargo' | 'gem' | 'nuget' | 'go' | 'other' {
        const type = (artifact?.type || '').toLowerCase();
        const name = (artifact?.name || '').toLowerCase();

        if (type.includes('npm') || name.includes('npm')) return 'npm';
        if (type.includes('pypi') || name.includes('pypi')) return 'pypi';
        if (type.includes('maven') || name.includes('maven')) return 'maven';
        if (type.includes('cargo') || name.includes('cargo')) return 'cargo';
        if (type.includes('gem') || name.includes('gem')) return 'gem';
        if (type.includes('nuget') || name.includes('nuget')) return 'nuget';
        if (type.includes('go') || name.includes('go')) return 'go';

        return 'other';
    }
}

export const remoteScannerAgent = new RemoteScannerAgent();

export default remoteScannerAgent;
