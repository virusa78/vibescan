import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { buildVulnerabilityIdentity } from '../../src/services/vulnerabilityIdentity.js';

const mockPool: { query: ReturnType<typeof jest.fn> } = {
    query: jest.fn(),
};

jest.mock('../../src/database/client.js', () => ({
    getPool: jest.fn(() => mockPool),
}));

import { SecurityScoreService } from '../../src/services/securityScoreService.js';

describe('SecurityScoreService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('applies deterministic scoring formula with accepted-risk exclusions', () => {
        const service = new SecurityScoreService();
        const vulnerabilities = [
            { cve_id: 'CVE-1', package_name: 'openssl', installed_version: '1.0.0', severity: 'CRITICAL', is_exploitable: true },
            { cve_id: 'CVE-2', package_name: 'lodash', installed_version: '4.17.0', severity: 'HIGH', is_exploitable: false },
            { cve_id: 'CVE-3', package_name: 'axios', installed_version: '0.1.0', severity: 'MEDIUM', is_exploitable: false },
        ];
        const accepted = new Set([
            buildVulnerabilityIdentity('CVE-3', 'axios', '0.1.0'),
        ]);

        const result = service.calculateSecurityScore(vulnerabilities, accepted);

        expect(result.score).toBe(65);
        expect(result.grade).toBe('D');
        expect(result.breakdown).toMatchObject({
            acceptedCount: 1,
            severityPenalty: 30,
            exploitablePenalty: 5,
            totalPenalty: 35,
            counts: {
                CRITICAL: 1,
                HIGH: 1,
                MEDIUM: 0,
                LOW: 0,
                INFO: 0,
            },
        });
    });

    it('returns stored snapshot and trend deltas', async () => {
        const service = new SecurityScoreService();
        mockPool.query
            .mockResolvedValueOnce({ rows: [{ id: 'scan-1', user_id: 'user-1', created_at: new Date().toISOString() }] })
            .mockResolvedValueOnce({
                rows: [{
                    id: 'ss-1',
                    scan_id: 'scan-1',
                    score: 83.5,
                    grade: 'B',
                    breakdown: { totalPenalty: 16.5 },
                    calculated_at: '2026-01-01T00:00:00.000Z',
                    created_at: '2026-01-01T00:00:00.000Z',
                }],
            })
            .mockResolvedValueOnce({
                rows: [
                    {
                        scan_id: 'scan-2',
                        score: 90,
                        grade: 'A',
                        breakdown: {},
                        calculated_at: '2026-01-02T00:00:00.000Z',
                        created_at: '2026-01-02T00:00:00.000Z',
                        scan_created_at: '2026-01-02T00:00:00.000Z',
                    },
                    {
                        scan_id: 'scan-1',
                        score: 83.5,
                        grade: 'B',
                        breakdown: {},
                        calculated_at: '2026-01-01T00:00:00.000Z',
                        created_at: '2026-01-01T00:00:00.000Z',
                        scan_created_at: '2026-01-01T00:00:00.000Z',
                    },
                ],
            });

        const snapshot = await service.getSnapshot('scan-1', 'user-1');
        const trend = await service.getTrend('user-1', 10);

        expect(snapshot.scan_id).toBe('scan-1');
        expect(snapshot.score).toBe(83.5);
        expect(trend[0]).toMatchObject({ scanId: 'scan-2', deltaFromPrevious: 6.5 });
        expect(trend[1]).toMatchObject({ scanId: 'scan-1', deltaFromPrevious: null });
    });
});
