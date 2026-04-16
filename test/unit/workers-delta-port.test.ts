import { describe, expect, it } from '@jest/globals';
import { canonicalizeVulnerabilities } from '@services/vulnerabilityCanonicalizer';
import { computeDelta } from '@services/diffEngine';
import { createFreeScanJobData, parseScanWorkerJob } from '../../src/workers/jobContract';

describe('workers-delta-port', () => {
    it('canonicalizes vulnerabilities before persistence/delta processing', () => {
        const [vulnerability] = canonicalizeVulnerabilities([{
            cve_id: '  CVE-2026-1234 ',
            severity: 'critical',
            cvss_score: '9.8',
            package_name: 'openssl',
            package_ecosystem: 'UnknownEco',
            installed_version: '1.0.1',
            references: ['https://b.example', 'https://a.example', 'https://a.example'],
            is_exploitable: 'yes',
        }], 'enterprise');

        expect(vulnerability).toMatchObject({
            cve_id: 'CVE-2026-1234',
            severity: 'CRITICAL',
            cvss_score: 9.8,
            package_ecosystem: 'other',
            references: ['https://a.example', 'https://b.example'],
            is_exploitable: true,
            source: 'enterprise',
        });
        expect(vulnerability.id).toBeTruthy();
    });

    it('keeps delta output deterministic with tie-breakers and normalized severity counts', () => {
        const free = [{ cve_id: 'CVE-1', severity: 'high', cvss_score: 7.1 }];
        const enterpriseOrderA = [
            { cve_id: 'CVE-3', package_name: 'zlib', installed_version: '1', severity: 'high', cvss_score: 8, is_exploitable: false, source: 'enterprise' },
            { cve_id: 'CVE-2', package_name: 'openssl', installed_version: '1', severity: 'HIGH', cvss_score: 8, is_exploitable: false, source: 'enterprise' },
            { cve_id: 'CVE-1', package_name: 'libc', installed_version: '1', severity: 'HIGH', cvss_score: 7.1, is_exploitable: false, source: 'enterprise' },
        ];
        const enterpriseOrderB = [...enterpriseOrderA].reverse();

        const deltaA = computeDelta(free, enterpriseOrderA);
        const deltaB = computeDelta(free, enterpriseOrderB);

        expect(deltaA.deltaVulnerabilities.map((v: any) => v.cve_id)).toEqual(['CVE-2', 'CVE-3']);
        expect(deltaB.deltaVulnerabilities.map((v: any) => v.cve_id)).toEqual(['CVE-2', 'CVE-3']);
        expect(deltaA.deltaBySeverity).toEqual({ CRITICAL: 0, HIGH: 2, MEDIUM: 0, LOW: 0 });
    });

    it('uses explicit queue/worker payload contract', () => {
        const payload = createFreeScanJobData('scan-123', [], null);
        const parsed = parseScanWorkerJob({ data: payload });
        expect(parsed.scanId).toBe('scan-123');
        expect(parsed.scenarioInput).toBeNull();
    });
});
