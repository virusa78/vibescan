/**
 * Unit tests for finding normalization
 */

import { describe, it, expect } from '@jest/globals';
import {
  normalizeGrypeFindings,
  normalizeCodescoringFindings,
  computeFindingFingerprint,
} from '../src/server/operations/scans/normalizeFindings';

describe('Finding Normalization', () => {
  describe('normalizeGrypeFindings', () => {
    it('should normalize valid Grype output', () => {
      const grypeOutput = {
        matches: [
          {
            vulnerability: {
              id: 'CVE-2024-1234',
              severity: 'HIGH',
              cvssScore: { baseScore: 7.5 },
              description: 'Test vulnerability',
              fix: { versions: ['1.0.1'] },
            },
            artifact: {
              name: 'lodash',
              version: '1.0.0',
            },
            matchDetails: [{ found: 'test' }],
          },
        ],
      };

      const findings = normalizeGrypeFindings(grypeOutput);

      expect(findings).toHaveLength(1);
      expect(findings[0]).toEqual({
        cveId: 'CVE-2024-1234',
        severity: 'high',
        package: 'lodash',
        version: '1.0.0',
        fixedVersion: '1.0.1',
        description: 'Test vulnerability',
        cvssScore: 7.5,
        source: 'free',
      });
    });

    it('should handle empty matches array', () => {
      const grypeOutput = { matches: [] };
      const findings = normalizeGrypeFindings(grypeOutput);
      expect(findings).toHaveLength(0);
    });

    it('should handle null or undefined input', () => {
      expect(normalizeGrypeFindings(null)).toEqual([]);
      expect(normalizeGrypeFindings(undefined)).toEqual([]);
      expect(normalizeGrypeFindings({})).toEqual([]);
    });

    it('should handle missing fix versions', () => {
      const grypeOutput = {
        matches: [
          {
            vulnerability: {
              id: 'CVE-2024-1234',
              severity: 'MEDIUM',
              cvssScore: { baseScore: 5.0 },
              description: 'Test',
            },
            artifact: {
              name: 'package',
              version: '1.0.0',
            },
          },
        ],
      };

      const findings = normalizeGrypeFindings(grypeOutput);
      expect(findings[0].fixedVersion).toBeUndefined();
    });
  });

  describe('normalizeCodescoringFindings', () => {
    it('should normalize valid Codescoring output', () => {
      const codescoringOutput = {
        components: [
          {
            name: 'lodash',
            version: '1.0.0',
            vulnerabilities: [
              {
                cveId: 'CVE-2024-5678',
                severity: 'CRITICAL',
                cvssScore: 9.2,
                description: 'Enterprise vulnerability',
                fixedVersion: '1.0.2',
              },
            ],
          },
        ],
      };

      const findings = normalizeCodescoringFindings(codescoringOutput);

      expect(findings).toHaveLength(1);
      expect(findings[0]).toEqual({
        cveId: 'CVE-2024-5678',
        severity: 'critical',
        package: 'lodash',
        version: '1.0.0',
        fixedVersion: '1.0.2',
        description: 'Enterprise vulnerability',
        cvssScore: 9.2,
        source: 'enterprise',
      });
    });

    it('should handle multiple components and vulnerabilities', () => {
      const codescoringOutput = {
        components: [
          {
            name: 'package1',
            version: '1.0.0',
            vulnerabilities: [
              {
                cveId: 'CVE-2024-1111',
                severity: 'HIGH',
                cvssScore: 8.0,
                description: 'Vuln 1',
              },
              {
                cveId: 'CVE-2024-2222',
                severity: 'MEDIUM',
                cvssScore: 5.0,
                description: 'Vuln 2',
              },
            ],
          },
          {
            name: 'package2',
            version: '2.0.0',
            vulnerabilities: [
              {
                cveId: 'CVE-2024-3333',
                severity: 'LOW',
                cvssScore: 3.0,
                description: 'Vuln 3',
              },
            ],
          },
        ],
      };

      const findings = normalizeCodescoringFindings(codescoringOutput);

      expect(findings).toHaveLength(3);
      expect(findings[0].package).toBe('package1');
      expect(findings[1].package).toBe('package1');
      expect(findings[2].package).toBe('package2');
    });

    it('should handle null or undefined input', () => {
      expect(normalizeCodescoringFindings(null)).toEqual([]);
      expect(normalizeCodescoringFindings(undefined)).toEqual([]);
      expect(normalizeCodescoringFindings({})).toEqual([]);
    });

    it('should skip components without vulnerabilities', () => {
      const codescoringOutput = {
        components: [
          {
            name: 'package1',
            version: '1.0.0',
            vulnerabilities: [
              {
                cveId: 'CVE-2024-1111',
                severity: 'HIGH',
                cvssScore: 8.0,
                description: 'Vuln 1',
              },
            ],
          },
          {
            name: 'package2',
            version: '2.0.0',
            // No vulnerabilities
          },
        ],
      };

      const findings = normalizeCodescoringFindings(codescoringOutput);

      expect(findings).toHaveLength(1);
      expect(findings[0].package).toBe('package1');
    });
  });

  describe('computeFindingFingerprint', () => {
    it('should compute consistent fingerprint', () => {
      const fp1 = computeFindingFingerprint('CVE-2024-1234', 'lodash', '1.0.0', '/path/to/file');
      const fp2 = computeFindingFingerprint('CVE-2024-1234', 'lodash', '1.0.0', '/path/to/file');

      expect(fp1).toBe(fp2);
    });

    it('should produce different fingerprints for different inputs', () => {
      const fp1 = computeFindingFingerprint('CVE-2024-1234', 'lodash', '1.0.0');
      const fp2 = computeFindingFingerprint('CVE-2024-5678', 'lodash', '1.0.0');
      const fp3 = computeFindingFingerprint('CVE-2024-1234', 'underscore', '1.0.0');

      expect(fp1).not.toBe(fp2);
      expect(fp1).not.toBe(fp3);
      expect(fp2).not.toBe(fp3);
    });

    it('should handle undefined file path', () => {
      const fp = computeFindingFingerprint('CVE-2024-1234', 'lodash', '1.0.0');
      expect(fp).toBeDefined();
      expect(fp).toContain('CVE-2024-1234');
      expect(fp).toContain('lodash');
    });
  });
});
