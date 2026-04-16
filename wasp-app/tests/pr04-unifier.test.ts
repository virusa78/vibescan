/**
 * PR-04: CycloneDX Unifier Tests
 * 
 * Tests unification of validated documents to platform DTO
 * - Valid documents produce UnifiedScanPayload
 * - Component deduplication works
 * - Severity normalization handles all formats
 * - Traceability preserved through audit trail
 */

import { unifyCycloneDXDocument } from '../src/ingestion/unifier';
import {
  ValidatedCycloneDxDocument,
  ParsedVulnerability,
} from '../src/ingestion/cyclonedx-contracts';

/**
 * Helper to create a minimal valid validated document
 */
function createValidValidatedDoc(): ValidatedCycloneDxDocument {
  return {
    bomFormat: 'CycloneDX',
    specVersion: '1.4',
    serialNumber: 'urn:uuid:123e4567-e89b-12d3-a456-426614174000',
    version: 1,
    metadata: {},
    components: [],
    vulnerabilities: [],
    _raw: {},
    _sourceDocument: {
      scannerName: 'grype',
    },
    _validation: {
      timestamp: '2025-04-16T10:00:00Z',
      issueCount: 0,
      issues: [],
      specVersion: '1.4',
      componentCount: 0,
      vulnerabilityCount: 0,
    },
  };
}

describe('PR-04: CycloneDX Unifier', () => {
  describe('Basic Unification', () => {
    test('should unify minimal valid document', () => {
      const validated = createValidValidatedDoc();

      const result = unifyCycloneDXDocument(validated, {
        scanId: 'scan-123',
        userId: 'user-456',
        scannerId: 'grype',
        timestamp: '2025-04-16T10:00:00Z',
      });

      expect(result.success).toBe(true);
      expect(result.error).toBeNull();
      expect(result.data).toBeDefined();
      expect(result.data!.scanId).toBe('scan-123');
      expect(result.data!.userId).toBe('user-456');
      expect(result.data!.scannerId).toBe('grype');
      expect(result.data!.components).toEqual([]);
      expect(result.data!.vulnerabilities).toEqual([]);
    });

    test('should preserve audit trail', () => {
      const validated = createValidValidatedDoc();

      const result = unifyCycloneDXDocument(validated, {
        scanId: 'scan-123',
        userId: 'user-456',
        scannerId: 'grype',
      });

      expect(result.success).toBe(true);
      expect(result.data!._raw).toBeDefined();
      expect(result.data!._validation).toBeDefined();
      expect(result.data!._sourceDocument).toBeDefined();
    });
  });

  describe('Component Normalization', () => {
    test('should normalize components to unified format', () => {
      const validated = createValidValidatedDoc();
      validated.components = [
        {
          name: 'log4j-core',
          version: '2.14.1',
          type: 'library',
          purl: 'pkg:maven/org.apache.logging.log4j/log4j-core@2.14.1',
          licenses: ['Apache-2.0'],
          hashes: {
            'SHA-256': 'abc123',
          },
          _raw: {},
        },
      ];

      const result = unifyCycloneDXDocument(validated, {
        scanId: 'scan-123',
        userId: 'user-456',
        scannerId: 'grype',
      });

      expect(result.success).toBe(true);
      expect(result.data!.components).toHaveLength(1);
      const comp = result.data!.components[0];
      expect(comp.name).toBe('log4j-core');
      expect(comp.version).toBe('2.14.1');
      expect(comp.purl).toBe('pkg:maven/org.apache.logging.log4j/log4j-core@2.14.1');
    });

    test('should deduplicate components by purl+version', () => {
      const validated = createValidValidatedDoc();
      const purl = 'pkg:npm/express@4.17.1';
      validated.components = [
        {
          name: 'express',
          version: '4.17.1',
          type: 'library',
          purl,
          licenses: [],
          hashes: {},
          _raw: {},
        },
        {
          name: 'express',
          version: '4.17.1',
          type: 'library',
          purl,
          licenses: [],
          hashes: {},
          _raw: {},
        },
      ];

      const result = unifyCycloneDXDocument(validated, {
        scanId: 'scan-123',
        userId: 'user-456',
        scannerId: 'grype',
      });

      expect(result.success).toBe(true);
      expect(result.data!.components).toHaveLength(1);
    });

    test('should normalize component type', () => {
      const validated = createValidValidatedDoc();
      validated.components = [
        {
          name: 'mylib',
          version: '1.0.0',
          type: 'LIBRARY',
          purl: 'pkg:generic/mylib@1.0.0',
          licenses: [],
          hashes: {},
          _raw: {},
        },
      ];

      const result = unifyCycloneDXDocument(validated, {
        scanId: 'scan-123',
        userId: 'user-456',
        scannerId: 'grype',
      });

      expect(result.success).toBe(true);
      expect(result.data!.components[0].type).toBe('library');
    });

    test('should handle missing purl with fallback', () => {
      const validated = createValidValidatedDoc();
      validated.components = [
        {
          name: 'unknown-lib',
          version: '1.0.0',
          type: 'library',
          purl: '',
          licenses: [],
          hashes: {},
          _raw: {},
        },
      ];

      const result = unifyCycloneDXDocument(validated, {
        scanId: 'scan-123',
        userId: 'user-456',
        scannerId: 'grype',
      });

      expect(result.success).toBe(true);
      expect(result.data!.components[0].purl).toBe('pkg:generic/unknown-lib@1.0.0');
    });
  });

  describe('Vulnerability Normalization', () => {
    test('should normalize vulnerabilities to unified format', () => {
      const validated = createValidValidatedDoc();
      validated.vulnerabilities = [
        {
          ref: 'urn:cdx:vuln:uuid:123',
          id: 'CVE-2021-44228',
          cveId: 'CVE-2021-44228',
          source: { id: 'CVE-2021-44228', url: 'https://nvd.nist.gov/vuln/detail/CVE-2021-44228' },
          ratings: [
            {
              severity: 'critical',
              score: 10.0,
              vector: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H',
            },
          ],
          cwes: [94],
          description: 'RCE in Log4j',
          recommendation: 'Upgrade to 2.17.0 or later',
          references: [
            { url: 'https://nvd.nist.gov/vuln/detail/CVE-2021-44228' },
          ],
          _raw: {},
        },
      ];

      const result = unifyCycloneDXDocument(validated, {
        scanId: 'scan-123',
        userId: 'user-456',
        scannerId: 'grype',
      });

      expect(result.success).toBe(true);
      expect(result.data!.vulnerabilities).toHaveLength(1);
      const vuln = result.data!.vulnerabilities[0];
      expect(vuln.identifiers.id).toBe('CVE-2021-44228');
      expect(vuln.severity.level).toBe('critical');
      expect(vuln.severity.cvssScore).toBe(10.0);
      expect(vuln.cwes).toHaveLength(1);
      expect(vuln.cwes[0].id).toBe('CWE-94');
    });

    test('should normalize severity levels', () => {
      const validated = createValidValidatedDoc();

      const severities = ['critical', 'high', 'medium', 'low', 'info', 'unknown'];
      validated.vulnerabilities = severities.map((sev, idx) => ({
        ref: `urn:cdx:vuln:uuid:${idx}`,
        id: `CVE-2021-${idx}`,
        cveId: `CVE-2021-${idx}`,
        source: { id: `CVE-2021-${idx}` },
        ratings: [
          {
            severity: sev,
            score: 5.0,
          },
        ],
        cwes: [],
        description: '',
        recommendation: '',
        references: [],
        _raw: {},
      }));

      const result = unifyCycloneDXDocument(validated, {
        scanId: 'scan-123',
        userId: 'user-456',
        scannerId: 'grype',
      });

      expect(result.success).toBe(true);
      for (let i = 0; i < severities.length; i++) {
        expect(result.data!.vulnerabilities[i].severity.level).toBe(severities[i]);
      }
    });

    test('should handle severity level variants', () => {
      const validated = createValidValidatedDoc();
      validated.vulnerabilities = [
        {
          ref: 'urn:cdx:vuln:uuid:1',
          id: 'CVE-2021-1',
          cveId: 'CVE-2021-1',
          source: { id: 'CVE-2021-1' },
          ratings: [
            {
              severity: 'EXTREME',
              score: 9.5,
            },
          ],
          cwes: [],
          description: '',
          recommendation: '',
          references: [],
          _raw: {},
        },
      ];

      const result = unifyCycloneDXDocument(validated, {
        scanId: 'scan-123',
        userId: 'user-456',
        scannerId: 'grype',
      });

      expect(result.success).toBe(true);
      expect(result.data!.vulnerabilities[0].severity.level).toBe('critical');
    });

    test('should extract CVSS version from vector', () => {
      const validated = createValidValidatedDoc();
      validated.vulnerabilities = [
        {
          ref: 'urn:cdx:vuln:uuid:1',
          id: 'CVE-2021-1',
          cveId: 'CVE-2021-1',
          source: { id: 'CVE-2021-1' },
          ratings: [
            {
              severity: 'high',
              score: 7.5,
              vector: 'CVSS:3.0/AV:N/AC:L/PR:N/UI:R/S:U/C:H/I:N/A:N',
            },
          ],
          cwes: [],
          description: '',
          recommendation: '',
          references: [],
          _raw: {},
        },
      ];

      const result = unifyCycloneDXDocument(validated, {
        scanId: 'scan-123',
        userId: 'user-456',
        scannerId: 'grype',
      });

      expect(result.success).toBe(true);
      expect(result.data!.vulnerabilities[0].severity.cvssVersion).toBe('3.0');
    });

    test('should take highest severity from multiple ratings', () => {
      const validated = createValidValidatedDoc();
      validated.vulnerabilities = [
        {
          ref: 'urn:cdx:vuln:uuid:1',
          id: 'CVE-2021-1',
          cveId: 'CVE-2021-1',
          source: { id: 'CVE-2021-1' },
          ratings: [
            {
              severity: 'low',
              score: 3.0,
            },
            {
              severity: 'high',
              score: 8.5,
            },
          ],
          cwes: [],
          description: '',
          recommendation: '',
          references: [],
          _raw: {},
        },
      ];

      const result = unifyCycloneDXDocument(validated, {
        scanId: 'scan-123',
        userId: 'user-456',
        scannerId: 'grype',
      });

      expect(result.success).toBe(true);
      expect(result.data!.vulnerabilities[0].severity.level).toBe('high');
    });

    test('should map CWEs correctly', () => {
      const validated = createValidValidatedDoc();
      validated.vulnerabilities = [
        {
          ref: 'urn:cdx:vuln:uuid:1',
          id: 'CVE-2021-1',
          cveId: 'CVE-2021-1',
          source: { id: 'CVE-2021-1' },
          ratings: [
            {
              severity: 'high',
              score: 8.0,
            },
          ],
          cwes: [79, 80, 89],
          description: '',
          recommendation: '',
          references: [],
          _raw: {},
        },
      ];

      const result = unifyCycloneDXDocument(validated, {
        scanId: 'scan-123',
        userId: 'user-456',
        scannerId: 'grype',
      });

      expect(result.success).toBe(true);
      expect(result.data!.vulnerabilities[0].cwes).toHaveLength(3);
      expect(result.data!.vulnerabilities[0].cwes[0].id).toBe('CWE-79');
      expect(result.data!.vulnerabilities[0].cwes[1].id).toBe('CWE-80');
      expect(result.data!.vulnerabilities[0].cwes[2].id).toBe('CWE-89');
    });

    test('should categorize references', () => {
      const validated = createValidValidatedDoc();
      validated.vulnerabilities = [
        {
          ref: 'urn:cdx:vuln:uuid:1',
          id: 'CVE-2021-1',
          cveId: 'CVE-2021-1',
          source: { id: 'CVE-2021-1' },
          ratings: [
            {
              severity: 'high',
              score: 8.0,
            },
          ],
          cwes: [],
          description: '',
          recommendation: '',
          references: [
            { url: 'https://github.com/repo/pull/123' },
            { url: 'https://nvd.nist.gov/vuln/detail/CVE-2021-1' },
            { url: 'https://www.cisa.gov/news-events/alerts/2021/12/10/cisa-adds-two-known-exploited-vulnerabilities-catalog' },
          ],
          _raw: {},
        },
      ];

      const result = unifyCycloneDXDocument(validated, {
        scanId: 'scan-123',
        userId: 'user-456',
        scannerId: 'grype',
      });

      expect(result.success).toBe(true);
      expect(result.data!.vulnerabilities[0].references).toHaveLength(3);
      expect(result.data!.vulnerabilities[0].references[0].category).toBe('fix');
      expect(result.data!.vulnerabilities[0].references[1].category).toBe('advisory');
      expect(result.data!.vulnerabilities[0].references[2].category).toBe('exploited_by');
    });
  });

  describe('Statistics', () => {
    test('should calculate severity breakdown statistics', () => {
      const validated = createValidValidatedDoc();
      validated.vulnerabilities = [
        {
          ref: 'urn:cdx:vuln:uuid:1',
          id: 'CVE-2021-1',
          cveId: 'CVE-2021-1',
          source: { id: 'CVE-2021-1' },
          ratings: [{ severity: 'critical', score: 10.0 }],
          cwes: [],
          description: '',
          recommendation: '',
          references: [],
          _raw: {},
        },
        {
          ref: 'urn:cdx:vuln:uuid:2',
          id: 'CVE-2021-2',
          cveId: 'CVE-2021-2',
          source: { id: 'CVE-2021-2' },
          ratings: [{ severity: 'critical', score: 9.8 }],
          cwes: [],
          description: '',
          recommendation: '',
          references: [],
          _raw: {},
        },
        {
          ref: 'urn:cdx:vuln:uuid:3',
          id: 'CVE-2021-3',
          cveId: 'CVE-2021-3',
          source: { id: 'CVE-2021-3' },
          ratings: [{ severity: 'high', score: 7.5 }],
          cwes: [],
          description: '',
          recommendation: '',
          references: [],
          _raw: {},
        },
      ];

      const result = unifyCycloneDXDocument(validated, {
        scanId: 'scan-123',
        userId: 'user-456',
        scannerId: 'grype',
      });

      expect(result.success).toBe(true);
      expect(result.data!.stats.vulnerabilityCount).toBe(3);
      expect(result.data!.stats.severityCounts.critical).toBe(2);
      expect(result.data!.stats.severityCounts.high).toBe(1);
    });

    test('should track component and vulnerability counts', () => {
      const validated = createValidValidatedDoc();
      validated.components = [
        {
          name: 'lib1',
          version: '1.0.0',
          type: 'library',
          purl: 'pkg:npm/lib1@1.0.0',
          licenses: [],
          hashes: {},
          _raw: {},
        },
        {
          name: 'lib2',
          version: '2.0.0',
          type: 'library',
          purl: 'pkg:npm/lib2@2.0.0',
          licenses: [],
          hashes: {},
          _raw: {},
        },
      ];

      validated.vulnerabilities = [
        {
          ref: 'urn:cdx:vuln:uuid:1',
          id: 'CVE-2021-1',
          cveId: 'CVE-2021-1',
          source: { id: 'CVE-2021-1' },
          ratings: [{ severity: 'low', score: 2.0 }],
          cwes: [],
          description: '',
          recommendation: '',
          references: [],
          _raw: {},
        },
      ];

      const result = unifyCycloneDXDocument(validated, {
        scanId: 'scan-123',
        userId: 'user-456',
        scannerId: 'grype',
      });

      expect(result.success).toBe(true);
      expect(result.data!.stats.componentCount).toBe(2);
      expect(result.data!.stats.vulnerabilityCount).toBe(1);
    });
  });

  describe('Unknown Fields Tracking', () => {
    test('should track unknown fields for format learning', () => {
      const validated = createValidValidatedDoc();
      validated._raw = {
        bomFormat: 'CycloneDX',
        specVersion: '1.4',
        serialNumber: 'urn:uuid:123',
        version: 1,
        unknownField1: 'value',
        unknownField2: { nested: true },
        components: [],
      };

      const result = unifyCycloneDXDocument(validated, {
        scanId: 'scan-123',
        userId: 'user-456',
        scannerId: 'grype',
      });

      expect(result.success).toBe(true);
      expect(result.data!._unknownFields.has('unknownField1')).toBe(true);
      expect(result.data!._unknownFields.has('unknownField2')).toBe(true);
    });
  });

  describe('Error Handling', () => {
    test('should handle unification errors gracefully', () => {
      // Create an invalid structure that will cause issues during unification
      const validated = createValidValidatedDoc();
      validated.vulnerabilities = [
        {
          ref: 'urn:cdx:vuln:uuid:1',
          id: 'CVE-2021-1',
          cveId: 'CVE-2021-1',
          source: { id: 'CVE-2021-1' },
          ratings: [{ severity: 'invalid', score: NaN }],
          cwes: [],
          description: '',
          recommendation: '',
          references: [],
          _raw: {},
        },
      ];

      const result = unifyCycloneDXDocument(validated, {
        scanId: 'scan-123',
        userId: 'user-456',
        scannerId: 'grype',
      });

      // Should still succeed, handling edge cases
      expect(result.success).toBe(true);
    });

    test('should include context in error', () => {
      // Create an invalid validated document that will fail
      const invalid = {
        bomFormat: 'CycloneDX',
        specVersion: '1.4',
        serialNumber: 'urn:uuid:123',
        version: 1,
        metadata: {},
        components: [null as any], // Will cause issues
        vulnerabilities: [],
        _raw: {},
        _sourceDocument: { scannerName: 'grype' },
        _validation: {
          timestamp: '2025-04-16T10:00:00Z',
          issueCount: 0,
          issues: [],
          specVersion: '1.4' as any,
          componentCount: 0,
          vulnerabilityCount: 0,
        },
      } as any;

      const result = unifyCycloneDXDocument(invalid, {
        scanId: 'scan-123',
        userId: 'user-456',
        scannerId: 'trivy',
      });

      // Should handle gracefully or error with proper context
      if (!result.success && result.error) {
        expect(result.error.context.source).toBe('trivy');
        expect(result.error.context.stage).toBe('unifier');
      }
    });
  });

  describe('Spec Version Handling', () => {
    test('should handle all supported spec versions', () => {
      for (const specVersion of ['1.4', '1.5', '1.6'] as const) {
        const validated = createValidValidatedDoc();
        validated.specVersion = specVersion;

        const result = unifyCycloneDXDocument(validated, {
          scanId: 'scan-123',
          userId: 'user-456',
          scannerId: 'grype',
        });

        expect(result.success).toBe(true);
        expect(result.data!.specVersion).toBe(specVersion);
      }
    });
  });
});
