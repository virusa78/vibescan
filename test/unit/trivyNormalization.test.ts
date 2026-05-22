import { describe, expect, it } from '@jest/globals';
import { normalizeTrivyFindings } from '../../wasp-app/src/server/operations/scans/normalizeFindings';

describe('normalizeTrivyFindings', () => {
  it('parses native Trivy vulnerability JSON', () => {
    const trivyOutput = {
      Results: [
        {
          Target: 'package-lock.json',
          Vulnerabilities: [
            {
              VulnerabilityID: 'CVE-2024-0001',
              PkgName: 'lodash',
              InstalledVersion: '1.0.0',
              FixedVersion: '1.0.1',
              Severity: 'HIGH',
              Description: 'Example vulnerability',
              CVSS: {
                nvd: { V3Score: 7.5 },
              },
            },
          ],
        },
      ],
    };

    const findings = normalizeTrivyFindings(trivyOutput);

    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({
      cveId: 'CVE-2024-0001',
      package: 'lodash',
      version: '1.0.0',
      fixedVersion: '1.0.1',
      severity: 'high',
      cvssScore: 7.5,
      source: 'trivy',
      filePath: 'package-lock.json',
    });
  });
});
