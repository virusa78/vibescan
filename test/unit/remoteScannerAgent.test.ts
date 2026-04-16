import { describe, expect, it } from '@jest/globals';
import { RemoteScannerAgent } from '../../src/services/remoteScannerAgent';

describe('RemoteScannerAgent', () => {
    const agent = new RemoteScannerAgent();

    it('normalizes github_app scenario and maps provider payload', () => {
        const scenario = agent.normalizeScenarioRequest({
            scenario: 'github_app',
            repo: 'octo-org/example-repo',
            ref: 'main',
        });
        const provider = agent.selectProvider('free');
        const payload = agent.toProviderPayload(scenario, provider);

        expect(scenario).toEqual({
            scenario: 'github_app',
            inputRef: 'octo-org/example-repo@main',
            github: { repo: 'octo-org/example-repo', ref: 'main' },
        });
        expect(payload.target).toEqual({
            type: 'github_repo',
            repo: 'octo-org/example-repo',
            ref: 'main',
        });
        expect(payload.provider).toBe('grype_like');
    });

    it('normalizes source_zip scenario and maps provider payload', () => {
        const scenario = agent.normalizeScenarioRequest({
            scenario: 'source_zip',
            s3Key: 'sources/scan-1.zip',
        });
        const payload = agent.toProviderPayload(scenario, agent.selectProvider('free'));

        expect(scenario).toEqual({
            scenario: 'source_zip',
            inputRef: 'sources/scan-1.zip',
            sourceZip: { s3Key: 'sources/scan-1.zip' },
        });
        expect(payload.target).toEqual({
            type: 'source_zip',
            s3Key: 'sources/scan-1.zip',
        });
    });

    it('normalizes sbom_upload scenario and maps provider payload', () => {
        const scenario = agent.normalizeScenarioRequest({
            scenario: 'sbom_upload',
            sbomRaw: { specVersion: '1.5', components: [] },
            sbomS3Key: 'sboms/scan-1.json',
        });
        const payload = agent.toProviderPayload(scenario, agent.selectProvider('free'));

        expect(scenario).toEqual({
            scenario: 'sbom_upload',
            inputRef: 'sboms/scan-1.json',
            sbom: {
                raw: { specVersion: '1.5', components: [] },
                s3Key: 'sboms/scan-1.json',
            },
        });
        expect(payload.target).toEqual({
            type: 'sbom',
            s3Key: 'sboms/scan-1.json',
            sbomRaw: { specVersion: '1.5', components: [] },
        });
    });

    it('supports provider override and keeps engine selection extensible', () => {
        const selected = agent.selectProvider('grype_like', 'grype_like');
        expect(selected).toEqual({ engine: 'grype_like', provider: 'grype_like' });
    });

    it('normalizes grype-like provider results to worker-compatible vulnerability shape', () => {
        const normalized = agent.normalizeProviderResult({
            scanId: 'scan-abc',
            rawOutput: {
                descriptor: { version: 'v0.79.1' },
                matches: [
                    {
                        artifact: { name: 'lodash', version: '4.17.20', type: 'npm', purl: 'pkg:npm/lodash@4.17.20' },
                        vulnerability: {
                            id: 'CVE-2024-9999',
                            severity: 'high',
                            cvss: [{ score: 8.1 }],
                            fix: [{ versions: ['4.17.21'] }],
                            description: 'Prototype pollution',
                            references: [{ url: 'https://example.com/CVE-2024-9999' }],
                        },
                    },
                ],
            },
            durationMs: 1234,
        }, 'free');

        expect(normalized.scanId).toBe('scan-abc');
        expect(normalized.scannerVersion).toBe('v0.79.1');
        expect(normalized.durationMs).toBe(1234);
        expect(normalized.vulnerabilities).toEqual([
            {
                cve_id: 'CVE-2024-9999',
                severity: 'HIGH',
                cvss_score: 8.1,
                package_name: 'lodash',
                package_ecosystem: 'npm',
                installed_version: '4.17.20',
                fixed_version: '4.17.21',
                purl: 'pkg:npm/lodash@4.17.20',
                epss_score: null,
                is_exploitable: false,
                description: 'Prototype pollution',
                references: ['https://example.com/CVE-2024-9999'],
                source: 'free',
            },
        ]);
    });

    it('supports provider registry and executeScenario flow', async () => {
        const customAgent = new RemoteScannerAgent();
        customAgent.registerProvider({
            id: 'mock_provider',
            execute: async () => ({
                scanId: 'scan-registry',
                rawOutput: {
                    matches: [
                        {
                            artifact: { name: 'pkg', version: '1.0.0', type: 'npm', purl: 'pkg:npm/pkg@1.0.0' },
                            vulnerability: { id: 'CVE-2026-1234', severity: 'medium', description: 'desc' },
                        },
                    ],
                },
                durationMs: 10,
            }),
        });

        const result = await customAgent.executeScenario(
            { scenario: 'source_zip', s3Key: 'sources/test.zip' },
            'grype_like',
            'mock_provider',
            'free',
        );

        expect(result.scanId).toBe('scan-registry');
        expect(result.vulnerabilities[0].cve_id).toBe('CVE-2026-1234');
        expect(result.vulnerabilities[0].severity).toBe('MEDIUM');
    });
});
