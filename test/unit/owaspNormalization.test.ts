import { describe, expect, it } from '@jest/globals';
import { normalizeOwaspFindings } from '../../wasp-app/src/server/operations/scans/normalizeFindings';

describe('normalizeOwaspFindings', () => {
  it('parses dependency-check dependency vulnerabilities', () => {
    const report = {
      dependencies: [
        {
          fileName: 'package-lock.json',
          filePath: '/src/package-lock.json',
          version: '1.0.0',
          vulnerabilities: [
            {
              name: 'CVE-2024-1234',
              severity: 'High',
              description: 'Example vulnerability',
              fixedVersion: '1.0.1',
              cvssv3: { baseScore: 7.5 },
            },
          ],
        },
      ],
    };

    const findings = normalizeOwaspFindings(report);

    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({
      cveId: 'CVE-2024-1234',
      package: 'package-lock.json',
      version: '1.0.0',
      fixedVersion: '1.0.1',
      severity: 'high',
      cvssScore: 7.5,
      source: 'owasp',
      filePath: '/src/package-lock.json',
    });
  });
});
