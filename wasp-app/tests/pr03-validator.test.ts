/**
 * PR-03: CycloneDX Validator Tests
 * 
 * Tests schema validation and runtime invariants
 * - Valid documents pass validation
 * - Invalid documents produce validation_error IngestionError
 * - Warnings are tracked but don't block
 * - All field constraints checked
 */

import {
  validateCycloneDXDocument,
} from '../src/ingestion/validator';
import {
  ParsedCycloneDxDocument,
} from '../src/ingestion/cyclonedx-contracts';

/**
 * Helper to create a minimal valid parsed document
 */
function createValidParsedDoc(): ParsedCycloneDxDocument {
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
      scannerName: 'test',
    },
  };
}

describe('PR-03: CycloneDX Validator', () => {
  describe('Valid Documents', () => {
    test('should validate minimal valid document', () => {
      const doc = createValidParsedDoc();

      const result = validateCycloneDXDocument(doc, {
        name: 'grype',
      });

      expect(result.success).toBe(true);
      expect(result.error).toBeNull();
      expect(result.data).toBeDefined();
      expect(result.data!._validation).toBeDefined();
    });

    test('should validate document with all spec versions', () => {
      for (const specVersion of ['1.4', '1.5', '1.6'] as const) {
        const doc = createValidParsedDoc();
        doc.specVersion = specVersion;

        const result = validateCycloneDXDocument(doc, { name: 'grype' });

        expect(result.success).toBe(true);
      }
    });

    test('should validate document with components', () => {
      const doc = createValidParsedDoc();
      doc.components = [
        {
          name: 'log4j-core',
          version: '2.14.1',
          type: 'library',
          purl: 'pkg:maven/org.apache.logging.log4j/log4j-core@2.14.1',
          licenses: [],
          hashes: {},
          _raw: {},
        },
      ];

      const result = validateCycloneDXDocument(doc, { name: 'grype' });

      expect(result.success).toBe(true);
    });

    test('should validate document with vulnerabilities', () => {
      const doc = createValidParsedDoc();
      doc.vulnerabilities = [
        {
          ref: 'urn:cdx:vuln:uuid:123',
          id: 'CVE-2021-44228',
          cveId: 'CVE-2021-44228',
          source: { id: 'CVE-2021-44228' },
          ratings: [
            {
              severity: 'critical',
              score: 10.0,
              vector: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H',
            },
          ],
          cwes: [94],
          description: 'test',
          recommendation: 'upgrade',
          references: [
            {
              url: 'https://example.com',
            },
          ],
          _raw: {},
        },
      ];

      const result = validateCycloneDXDocument(doc, { name: 'grype' });

      expect(result.success).toBe(true);
    });
  });

  describe('Invalid Mandatory Fields', () => {
    test('should reject invalid bomFormat', () => {
      const doc = createValidParsedDoc();
      doc.bomFormat = 'SBOM';

      const result = validateCycloneDXDocument(doc, { name: 'grype' });

      expect(result.success).toBe(false);
      expect(result.error!.code).toBe('SCHEMA_VIOLATION');
      expect(result.error!.details?.errorCount).toBeGreaterThan(0);
    });

    test('should reject unsupported specVersion', () => {
      const doc = createValidParsedDoc();
      doc.specVersion = '1.3' as any;

      const result = validateCycloneDXDocument(doc, { name: 'grype' });

      expect(result.success).toBe(false);
      expect(result.error!.details?.errorCount).toBeGreaterThan(0);
    });

    test('should reject empty serialNumber', () => {
      const doc = createValidParsedDoc();
      doc.serialNumber = '';

      const result = validateCycloneDXDocument(doc, { name: 'grype' });

      expect(result.success).toBe(false);
      expect(result.error!.details?.errorCount).toBeGreaterThan(0);
    });

    test('should reject negative version', () => {
      const doc = createValidParsedDoc();
      doc.version = -1;

      const result = validateCycloneDXDocument(doc, { name: 'grype' });

      expect(result.success).toBe(false);
    });
  });

  describe('Component Validation', () => {
    test('should reject component without name', () => {
      const doc = createValidParsedDoc();
      doc.components = [
        {
          name: '',
          version: '1.0.0',
          type: 'library',
          purl: '',
          licenses: [],
          hashes: {},
          _raw: {},
        },
      ];

      const result = validateCycloneDXDocument(doc, { name: 'grype' });

      expect(result.success).toBe(false);
      expect(result.error!.details?.errorCount).toBeGreaterThan(0);
    });

    test('should reject component without version', () => {
      const doc = createValidParsedDoc();
      doc.components = [
        {
          name: 'log4j',
          version: '',
          type: 'library',
          purl: '',
          licenses: [],
          hashes: {},
          _raw: {},
        },
      ];

      const result = validateCycloneDXDocument(doc, { name: 'grype' });

      expect(result.success).toBe(false);
    });

    test('should warn on unknown component type', () => {
      const doc = createValidParsedDoc();
      doc.components = [
        {
          name: 'mylib',
          version: '1.0.0',
          type: 'unknown-type' as any,
          purl: 'pkg:npm/mylib@1.0.0',
          licenses: [],
          hashes: {},
          _raw: {},
        },
      ];

      const result = validateCycloneDXDocument(doc, { name: 'grype' });

      expect(result.success).toBe(true);
      expect(result.data!._validation.warningCount).toBeGreaterThan(0);
    });

    test('should warn on invalid purl format', () => {
      const doc = createValidParsedDoc();
      doc.components = [
        {
          name: 'mylib',
          version: '1.0.0',
          type: 'library',
          purl: 'not-a-purl',
          licenses: [],
          hashes: {},
          _raw: {},
        },
      ];

      const result = validateCycloneDXDocument(doc, { name: 'grype' });

      expect(result.success).toBe(true);
      expect(result.data!._validation.warningCount).toBeGreaterThan(0);
    });

    test('should warn on duplicate purl', () => {
      const doc = createValidParsedDoc();
      const purl = 'pkg:npm/mylib@1.0.0';
      doc.components = [
        {
          name: 'mylib',
          version: '1.0.0',
          type: 'library',
          purl,
          licenses: [],
          hashes: {},
          _raw: {},
        },
        {
          name: 'mylib',
          version: '1.0.0',
          type: 'library',
          purl,
          licenses: [],
          hashes: {},
          _raw: {},
        },
      ];

      const result = validateCycloneDXDocument(doc, { name: 'grype' });

      expect(result.success).toBe(true);
      expect(result.data!._validation.warningCount).toBeGreaterThan(0);
    });

    test('should validate hashes', () => {
      const doc = createValidParsedDoc();
      doc.components = [
        {
          name: 'mylib',
          version: '1.0.0',
          type: 'library',
          purl: 'pkg:npm/mylib@1.0.0',
          licenses: [],
          hashes: {
            'SHA-256': 'abc123',
            'SHA-1': '',
          },
          _raw: {},
        },
      ];

      const result = validateCycloneDXDocument(doc, { name: 'grype' });

      expect(result.success).toBe(true);
      expect(result.data!._validation.warningCount).toBeGreaterThan(0);
    });
  });

  describe('Vulnerability Validation', () => {
    test('should reject vulnerability without ref', () => {
      const doc = createValidParsedDoc();
      doc.vulnerabilities = [
        {
          ref: '',
          id: 'CVE-2021-44228',
          cveId: 'CVE-2021-44228',
          source: { id: 'CVE-2021-44228' },
          ratings: [
            {
              severity: 'critical',
              score: 10.0,
            },
          ],
          cwes: [],
          description: '',
          recommendation: '',
          references: [],
          _raw: {},
        },
      ];

      const result = validateCycloneDXDocument(doc, { name: 'grype' });

      expect(result.success).toBe(false);
      expect(result.error!.details?.errorCount).toBeGreaterThan(0);
    });

    test('should reject vulnerability without cveId and source.id', () => {
      const doc = createValidParsedDoc();
      doc.vulnerabilities = [
        {
          ref: 'urn:cdx:vuln:uuid:123',
          id: '',
          cveId: '',
          source: { id: '' },
          ratings: [
            {
              severity: 'critical',
              score: 10.0,
            },
          ],
          cwes: [],
          description: '',
          recommendation: '',
          references: [],
          _raw: {},
        },
      ];

      const result = validateCycloneDXDocument(doc, { name: 'grype' });

      expect(result.success).toBe(false);
    });

    test('should warn on invalid CVE format', () => {
      const doc = createValidParsedDoc();
      doc.vulnerabilities = [
        {
          ref: 'urn:cdx:vuln:uuid:123',
          id: 'INVALID-CVE',
          cveId: 'INVALID-CVE',
          source: { id: 'INVALID-CVE' },
          ratings: [
            {
              severity: 'critical',
              score: 10.0,
            },
          ],
          cwes: [],
          description: '',
          recommendation: '',
          references: [],
          _raw: {},
        },
      ];

      const result = validateCycloneDXDocument(doc, { name: 'grype' });

      expect(result.success).toBe(true);
      expect(result.data!._validation.warningCount).toBeGreaterThan(0);
    });

    test('should warn on missing ratings', () => {
      const doc = createValidParsedDoc();
      doc.vulnerabilities = [
        {
          ref: 'urn:cdx:vuln:uuid:123',
          id: 'CVE-2021-44228',
          cveId: 'CVE-2021-44228',
          source: { id: 'CVE-2021-44228' },
          ratings: [],
          cwes: [],
          description: '',
          recommendation: '',
          references: [],
          _raw: {},
        },
      ];

      const result = validateCycloneDXDocument(doc, { name: 'grype' });

      expect(result.success).toBe(true);
      expect(result.data!._validation.warningCount).toBeGreaterThan(0);
    });

    test('should reject CVSS score out of range', () => {
      const doc = createValidParsedDoc();
      doc.vulnerabilities = [
        {
          ref: 'urn:cdx:vuln:uuid:123',
          id: 'CVE-2021-44228',
          cveId: 'CVE-2021-44228',
          source: { id: 'CVE-2021-44228' },
          ratings: [
            {
              severity: 'critical',
              score: 15.0,
            },
          ],
          cwes: [],
          description: '',
          recommendation: '',
          references: [],
          _raw: {},
        },
      ];

      const result = validateCycloneDXDocument(doc, { name: 'grype' });

      expect(result.success).toBe(false);
    });

    test('should warn on unknown severity', () => {
      const doc = createValidParsedDoc();
      doc.vulnerabilities = [
        {
          ref: 'urn:cdx:vuln:uuid:123',
          id: 'CVE-2021-44228',
          cveId: 'CVE-2021-44228',
          source: { id: 'CVE-2021-44228' },
          ratings: [
            {
              severity: 'extreme',
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

      const result = validateCycloneDXDocument(doc, { name: 'grype' });

      expect(result.success).toBe(true);
      expect(result.data!._validation.warningCount).toBeGreaterThan(0);
    });

    test('should warn on invalid CVSS vector format', () => {
      const doc = createValidParsedDoc();
      doc.vulnerabilities = [
        {
          ref: 'urn:cdx:vuln:uuid:123',
          id: 'CVE-2021-44228',
          cveId: 'CVE-2021-44228',
          source: { id: 'CVE-2021-44228' },
          ratings: [
            {
              severity: 'critical',
              score: 10.0,
              vector: 'INVALID-VECTOR',
            },
          ],
          cwes: [],
          description: '',
          recommendation: '',
          references: [],
          _raw: {},
        },
      ];

      const result = validateCycloneDXDocument(doc, { name: 'grype' });

      expect(result.success).toBe(true);
      expect(result.data!._validation.warningCount).toBeGreaterThan(0);
    });

    test('should warn on invalid CWE', () => {
      const doc = createValidParsedDoc();
      doc.vulnerabilities = [
        {
          ref: 'urn:cdx:vuln:uuid:123',
          id: 'CVE-2021-44228',
          cveId: 'CVE-2021-44228',
          source: { id: 'CVE-2021-44228' },
          ratings: [
            {
              severity: 'critical',
              score: 10.0,
            },
          ],
          cwes: [-1, 94],
          description: '',
          recommendation: '',
          references: [],
          _raw: {},
        },
      ];

      const result = validateCycloneDXDocument(doc, { name: 'grype' });

      expect(result.success).toBe(true);
      expect(result.data!._validation.warningCount).toBeGreaterThan(0);
    });

    test('should warn on invalid reference URL', () => {
      const doc = createValidParsedDoc();
      doc.vulnerabilities = [
        {
          ref: 'urn:cdx:vuln:uuid:123',
          id: 'CVE-2021-44228',
          cveId: 'CVE-2021-44228',
          source: { id: 'CVE-2021-44228' },
          ratings: [
            {
              severity: 'critical',
              score: 10.0,
            },
          ],
          cwes: [94],
          description: '',
          recommendation: '',
          references: [
            {
              url: 'not-a-url',
            },
          ],
          _raw: {},
        },
      ];

      const result = validateCycloneDXDocument(doc, { name: 'grype' });

      expect(result.success).toBe(true);
      expect(result.data!._validation.warningCount).toBeGreaterThan(0);
    });
  });

  describe('Validation Metadata', () => {
    test('should include validation metadata in result', () => {
      const doc = createValidParsedDoc();

      const result = validateCycloneDXDocument(doc, { name: 'grype' });

      expect(result.success).toBe(true);
      expect(result.data!._validation.timestamp).toBeDefined();
      expect(result.data!._validation.issueCount).toBe(0);
      expect(result.data!._validation.specVersion).toBe('1.4');
      expect(result.data!._validation.componentCount).toBe(0);
      expect(result.data!._validation.vulnerabilityCount).toBe(0);
    });

    test('should track issue counts correctly', () => {
      const doc = createValidParsedDoc();
      doc.specVersion = '1.3' as any;
      doc.serialNumber = '';
      doc.components = [
        {
          name: '',
          version: '1.0.0',
          type: 'library',
          purl: '',
          licenses: [],
          hashes: {},
          _raw: {},
        },
      ];

      const result = validateCycloneDXDocument(doc, { name: 'grype' });

      expect(result.success).toBe(false);
      expect(result.error!.details?.errorCount).toBeGreaterThan(0);
    });

    test('should include issues list in error', () => {
      const doc = createValidParsedDoc();
      doc.bomFormat = 'SBOM';

      const result = validateCycloneDXDocument(doc, { name: 'grype' });

      expect(result.success).toBe(false);
      expect(result.error!.details?.issues).toBeDefined();
      expect(Array.isArray(result.error!.details?.issues)).toBe(true);
    });
  });

  describe('Serial Number Validation', () => {
    test('should accept urn:uuid: format', () => {
      const doc = createValidParsedDoc();
      doc.serialNumber = 'urn:uuid:123e4567-e89b-12d3-a456-426614174000';

      const result = validateCycloneDXDocument(doc, { name: 'grype' });

      expect(result.success).toBe(true);
    });

    test('should accept UUID format without urn:', () => {
      const doc = createValidParsedDoc();
      doc.serialNumber = '123e4567-e89b-12d3-a456-426614174000';

      const result = validateCycloneDXDocument(doc, { name: 'grype' });

      expect(result.success).toBe(true);
    });

    test('should accept any non-empty serialNumber with warning', () => {
      const doc = createValidParsedDoc();
      doc.serialNumber = 'custom-scan-id-123';

      const result = validateCycloneDXDocument(doc, { name: 'grype' });

      expect(result.success).toBe(true);
      // May have warnings about format
    });
  });

  describe('Error Context', () => {
    test('should include source in error context', () => {
      const doc = createValidParsedDoc();
      doc.bomFormat = 'INVALID';

      const result = validateCycloneDXDocument(doc, {
        name: 'snyk',
        timestamp: '2025-04-16T10:00:00Z',
      });

      expect(result.success).toBe(false);
      expect(result.error!.context.source).toBe('snyk');
      expect(result.error!.context.stage).toBe('validator');
      expect(result.error!.context.timestamp).toBe('2025-04-16T10:00:00Z');
    });
  });
});
