/**
 * Unit tests for scanner utilities
 */

import { describe, it, expect, jest } from '@jest/globals';
import { parseGrypOutput } from '../wasp-app/src/server/lib/scanners/grypeScannerUtil';
import {
  parseCodescoringResponse,
  scanWithCodescoring,
  scanWithCodescoringDetailed,
} from '../wasp-app/src/server/lib/scanners/codescoringApiClient';
import type { NormalizedComponent } from '../wasp-app/src/server/services/inputAdapterService';

// Mock child_process and fs using standard jest.mock and jest.requireActual
jest.mock('child_process', () => {
  const actual = jest.requireActual('child_process') as any;
  return {
    ...actual,
    execSync: jest.fn(),
    execFileSync: jest.fn().mockImplementation((cmd, args) => {
      if (cmd === 'ssh' && Array.isArray(args) && args[args.length - 1] === 'mktemp -d') {
        return '/tmp/remote-temp\n';
      }
      if (cmd === 'ssh') {
        return 'ssh-success';
      }
      if (cmd === 'scp') {
        return 'scp-success';
      }
      return '';
    }),
    execFile: jest.fn().mockImplementation((cmd, args, options, callback) => {
      const cb = typeof options === 'function' ? options : callback;
      if (cmd === 'ssh' && Array.isArray(args) && args[args.length - 1] === 'mktemp -d') {
        if (cb) cb(null, '/tmp/remote-temp\n', '');
      } else if (cmd === 'ssh') {
        if (cb) cb(null, 'ssh-success', '');
      } else if (cmd === 'scp') {
        if (cb) cb(null, 'scp-success', '');
      } else {
        if (cb) cb(null, '', '');
      }
    }),
  };
});

jest.mock('fs', () => {
  const actual = jest.requireActual('fs') as any;
  return {
    ...actual,
    readFileSync: jest.fn().mockImplementation(() => {
      return JSON.stringify({
        bomFormat: 'CycloneDX',
        components: [
          {
            name: 'lodash',
            version: '4.17.21',
            'bom-ref': 'pkg:npm/lodash@4.17.21',
          },
        ],
        vulnerabilities: [
          {
            id: 'CVE-2021-23337',
            ratings: [{ score: 8.1, severity: 'HIGH' }],
            affects: [{ ref: 'pkg:npm/lodash@4.17.21' }],
            fixes: [{ version: '4.17.22' }],
            description: 'lodash vulnerability',
          },
        ],
      });
    }),
    mkdirSync: jest.fn(),
    rmSync: jest.fn(),
    existsSync: jest.fn().mockReturnValue(true),
  };
});

describe('Grype Scanner Utility', () => {
  describe('parseGrypOutput', () => {
    it('should parse valid Grype JSON output', () => {
      const grypOutput = {
        matches: [
          {
            vulnerability: {
              id: 'CVE-2024-1234',
              severity: 'high',
              cvssScore: { baseScore: 7.5 },
              description: 'Test vulnerability',
              fix: { versions: ['1.0.1'] },
            },
            artifact: {
              name: 'lodash',
              version: '1.0.0',
            },
          },
          {
            vulnerability: {
              id: 'CVE-2024-5678',
              severity: 'critical',
              cvssScore: { baseScore: 9.2 },
              description: 'Critical vulnerability',
              fix: { versions: ['2.0.0'] },
            },
            artifact: {
              name: 'express',
              version: '4.0.0',
            },
          },
        ],
      };

      const findings = parseGrypOutput(grypOutput);

      expect(findings).toHaveLength(2);
      expect(findings[0].cveId).toBe('CVE-2024-1234');
      expect(findings[0].package).toBe('lodash');
      expect(findings[0].version).toBe('1.0.0');
      expect(findings[0].severity).toBe('high');
      expect(findings[0].cvssScore).toBe(7.5);
      expect(findings[0].fixedVersion).toBe('1.0.1');
      expect(findings[0].source).toBe('grype');

      expect(findings[1].cveId).toBe('CVE-2024-5678');
      expect(findings[1].severity).toBe('critical');
      expect(findings[1].cvssScore).toBe(9.2);
    });

    it('should handle empty matches array', () => {
      const grypOutput = { matches: [] };
      const findings = parseGrypOutput(grypOutput);
      expect(findings).toHaveLength(0);
    });

    it('should handle missing vulnerability data', () => {
      const grypOutput = {
        matches: [
          {
            artifact: { name: 'lodash', version: '1.0.0' },
          },
        ],
      };

      const findings = parseGrypOutput(grypOutput);
      expect(findings).toHaveLength(1);
      expect(findings[0].cveId).toBe('UNKNOWN');
      expect(findings[0].description).toBe('');
    });

    it('should handle missing artifact data', () => {
      const grypOutput = {
        matches: [
          {
            vulnerability: {
              id: 'CVE-2024-1234',
              severity: 'high',
              cvssScore: { baseScore: 7.5 },
              description: 'Test',
            },
          },
        ],
      };

      const findings = parseGrypOutput(grypOutput);
      expect(findings).toHaveLength(1);
      expect(findings[0].package).toBe('unknown');
      expect(findings[0].version).toBe('unknown');
    });

    it('should handle null/undefined output', () => {
      expect(parseGrypOutput(null)).toHaveLength(0);
      expect(parseGrypOutput(undefined)).toHaveLength(0);
      expect(parseGrypOutput({})).toHaveLength(0);
      expect(parseGrypOutput({ matches: null })).toHaveLength(0);
    });

    it('should normalize severity to lowercase', () => {
      const grypOutput = {
        matches: [
          {
            vulnerability: {
              id: 'CVE-2024-1234',
              severity: 'CRITICAL',
              cvssScore: { baseScore: 9.0 },
            },
            artifact: { name: 'pkg', version: '1.0' },
          },
        ],
      };

      const findings = parseGrypOutput(grypOutput);
      expect(findings[0].severity).toBe('critical');
    });

    it('should handle missing fix versions', () => {
      const grypOutput = {
        matches: [
          {
            vulnerability: {
              id: 'CVE-2024-1234',
              severity: 'high',
              cvssScore: { baseScore: 7.5 },
            },
            artifact: { name: 'lodash', version: '1.0.0' },
          },
        ],
      };

      const findings = parseGrypOutput(grypOutput);
      expect(findings[0].fixedVersion).toBeUndefined();
    });

    it('should handle CVSS score parsing', () => {
      const grypOutput = {
        matches: [
          {
            vulnerability: {
              id: 'CVE-2024-1234',
              severity: 'high',
              cvssScore: { baseScore: '8.5' },
            },
            artifact: { name: 'pkg', version: '1.0' },
          },
        ],
      };

      const findings = parseGrypOutput(grypOutput);
      expect(findings[0].cvssScore).toBe(8.5);
    });

    it('should handle invalid CVSS score', () => {
      const grypOutput = {
        matches: [
          {
            vulnerability: {
              id: 'CVE-2024-1234',
              severity: 'high',
              cvssScore: { baseScore: 'invalid' },
            },
            artifact: { name: 'pkg', version: '1.0' },
          },
        ],
      };

      const findings = parseGrypOutput(grypOutput);
      expect(findings[0].cvssScore).toBe(0);
    });
  });
});

describe('Codescoring API Client', () => {
  describe('parseCodescoringResponse', () => {
    it('returns empty array on null/undefined input', () => {
      expect(parseCodescoringResponse(null as any)).toEqual([]);
      expect(parseCodescoringResponse(undefined as any)).toEqual([]);
    });

    it('parses CycloneDX format correctly', () => {
      const cdSbom = {
        bomFormat: 'CycloneDX',
        components: [
          {
            name: 'lodash',
            version: '4.17.21',
            bomRef: 'pkg:npm/lodash@4.17.21',
          },
          {
            name: 'express',
            version: '4.18.2',
            purl: 'pkg:npm/express@4.18.2',
          },
        ],
        vulnerabilities: [
          {
            id: 'CVE-2021-23337',
            ratings: [{ score: 8.1, severity: 'HIGH' }],
            affects: [{ ref: 'pkg:npm/lodash@4.17.21' }],
            fixes: [{ version: '4.17.22' }],
            description: 'lodash vulnerability',
          },
          {
            bomRef: 'vuln-2',
            ratings: [{ score: 5.0, severity: 'medium' }],
            affects: [{ ref: 'pkg:npm/express@4.18.2' }],
          },
        ],
      };

      const findings = parseCodescoringResponse(cdSbom);
      expect(findings).toHaveLength(2);
      
      const f1 = findings.find((f) => f.package === 'lodash')!;
      expect(f1.cveId).toBe('CVE-2021-23337');
      expect(f1.severity).toBe('high');
      expect(f1.fixedVersion).toBe('4.17.22');
      expect(f1.cvssScore).toBe(8.1);

      const f2 = findings.find((f) => f.package === 'express')!;
      expect(f2.cveId).toBe('vuln-2');
      expect(f2.severity).toBe('medium');
      expect(f2.fixedVersion).toBeUndefined();
    });

    it('parses Legacy API format correctly', () => {
      const legacyResponse = {
        vulnerabilities: [
          {
            cveId: 'CVE-2024-0001',
            severity: 'CRITICAL',
            packageName: 'lodash',
            version: '4.17.21',
            fixedVersion: '4.17.22',
            description: 'legacy lodash vuln',
            cvssScore: '9.8',
          },
        ],
      };

      const findings = parseCodescoringResponse(legacyResponse);
      expect(findings).toHaveLength(1);
      expect(findings[0].package).toBe('lodash');
      expect(findings[0].cveId).toBe('CVE-2024-0001');
      expect(findings[0].severity).toBe('critical');
      expect(findings[0].cvssScore).toBe(9.8);
    });

    it('parses Component-shaped legacy format correctly', () => {
      const componentResponse = {
        components: [
          {
            name: 'express',
            version: '4.18.0',
            vulnerabilities: [
              {
                cveId: 'CVE-2024-0002',
                severity: 'medium',
                fixedVersion: '4.18.1',
                description: 'express vuln',
                cvssScore: 5.4,
              },
            ],
          },
        ],
      };

      const findings = parseCodescoringResponse(componentResponse);
      expect(findings).toHaveLength(1);
      expect(findings[0].package).toBe('express');
      expect(findings[0].cveId).toBe('CVE-2024-0002');
      expect(findings[0].severity).toBe('medium');
      expect(findings[0].cvssScore).toBe(5.4);
    });
  });

  describe('scanWithCodescoring', () => {
    it('uses mock findings if SSH is not fully configured', async () => {
      const components: NormalizedComponent[] = [
        { name: 'lodash', version: '1.0.0' },
        { name: 'express', version: '4.0.0' },
        { name: 'unknown-pkg', version: '1.0.0' },
      ];

      // Since we don't configure CODESCORING_SSH_* env vars, it should run mock mode
      const result = await scanWithCodescoring(components, 'scan-mock');
      expect(result).toHaveLength(2); // lodash and express have mock vulns
      expect(result.find((f) => f.package === 'lodash')).toBeDefined();
    });

    it('executes SSH scan client when SSH is configured', async () => {
      // Set CODESCORING_SSH_* env vars
      process.env.CODESCORING_SSH_HOST = 'test-host';
      process.env.CODESCORING_SSH_USER = 'test-user';
      process.env.CODESCORING_SSH_KEY_PATH = '/path/to/key';

      const components: NormalizedComponent[] = [
        { name: 'lodash', version: '4.17.21' },
      ];

      const input = { inputType: 'source_zip', inputRef: 'source.zip' };
      const run = await scanWithCodescoringDetailed(components, 'scan-ssh', input);

      expect(run.scannerVersion).toBe('codescoring-johnny');
      expect(run.findings.length).toBe(1);
      expect(run.findings[0].package).toBe('lodash');

      // Test with sbom input
      const runSbom = await scanWithCodescoringDetailed(components, 'scan-ssh-2', {
        inputType: 'sbom',
        inputRef: 'sbom.json',
      });
      expect(runSbom.findings.length).toBe(1);

      // Clean up env vars
      delete process.env.CODESCORING_SSH_HOST;
      delete process.env.CODESCORING_SSH_USER;
      delete process.env.CODESCORING_SSH_KEY_PATH;
    });
  });
});
