/**
 * PR-02: CycloneDX Parser Tests
 * 
 * Tests the safe parsing of raw CycloneDX documents
 * - Valid documents normalize correctly
 * - Invalid documents produce parse_error IngestionError
 * - Edge cases handled gracefully
 */

import { parseCycloneDXDocument } from '../src/ingestion/parser';
import { IngestionError } from '../src/ingestion/cyclonedx-contracts';

describe('PR-02: CycloneDX Parser', () => {
  describe('Valid Documents', () => {
    test('should parse valid CycloneDX 1.4 document', () => {
      const validDoc = {
        bomFormat: 'CycloneDX',
        specVersion: '1.4',
        serialNumber: 'urn:uuid:123e4567-e89b-12d3-a456-426614174000',
        version: 1,
        metadata: {
          timestamp: '2025-04-16T10:00:00Z',
          tools: [
            {
              name: 'grype',
              version: '0.65.0',
            },
          ],
        },
        components: [
          {
            name: 'log4j-core',
            version: '2.14.1',
            type: 'library',
            purl: 'pkg:maven/org.apache.logging.log4j/log4j-core@2.14.1',
            licenses: [
              {
                expression: 'Apache-2.0',
              },
            ],
            hashes: [
              {
                alg: 'SHA-1',
                content: 'd1234567890abcdef',
              },
            ],
          },
        ],
        vulnerabilities: [
          {
            ref: 'urn:cdx:vuln:uuid:123',
            id: 'CVE-2021-44228',
            source: {
              id: 'CVE-2021-44228',
              url: 'https://nvd.nist.gov/vuln/detail/CVE-2021-44228',
            },
            ratings: [
              {
                severity: 'critical',
                score: 10.0,
                vector: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H',
              },
            ],
            description: 'Apache Log4j2 remote code execution',
            cwes: [94],
            references: [
              {
                url: 'https://www.cisa.gov/news-events/alerts/2021/12/10/cisa-adds-two-known-exploited-vulnerabilities-catalog',
              },
            ],
          },
        ],
      };

      const result = parseCycloneDXDocument(validDoc, {
        name: 'grype',
        version: '0.65.0',
      });

      expect(result.success).toBe(true);
      expect(result.error).toBeNull();
      expect(result.data).toBeDefined();
      expect(result.data!.bomFormat).toBe('CycloneDX');
      expect(result.data!.specVersion).toBe('1.4');
      expect(result.data!.components).toHaveLength(1);
      expect(result.data!.components[0].name).toBe('log4j-core');
      expect(result.data!.vulnerabilities).toHaveLength(1);
      expect(result.data!.vulnerabilities[0].cveId).toBe('CVE-2021-44228');
      expect(result.data!.vulnerabilities[0].ratings[0].severity).toBe('critical');
      expect(result.data!._raw).toBeDefined();
      expect(result.data!._sourceDocument.scannerName).toBe('grype');
    });

    test('should parse CycloneDX 1.5 document', () => {
      const doc15 = {
        bomFormat: 'CycloneDX',
        specVersion: '1.5',
        serialNumber: 'urn:uuid:456e5678-e89b-12d3-a456-426614174111',
        version: 1,
        metadata: {},
        components: [],
        vulnerabilities: [],
      };

      const result = parseCycloneDXDocument(doc15, {
        name: 'trivy',
      });

      expect(result.success).toBe(true);
      expect(result.data!.specVersion).toBe('1.5');
    });

    test('should parse CycloneDX 1.6 document', () => {
      const doc16 = {
        bomFormat: 'CycloneDX',
        specVersion: '1.6',
        serialNumber: 'urn:uuid:789f8901-e89b-12d3-a456-426614174222',
        version: 1,
        metadata: {},
        components: [],
        vulnerabilities: [],
      };

      const result = parseCycloneDXDocument(doc16, {
        name: 'clair',
      });

      expect(result.success).toBe(true);
      expect(result.data!.specVersion).toBe('1.6');
    });
  });

  describe('Invalid Documents - Missing Fields', () => {
    test('should reject document without bomFormat', () => {
      const invalidDoc = {
        specVersion: '1.4',
        serialNumber: 'urn:uuid:123e4567-e89b-12d3-a456-426614174000',
        version: 1,
      };

      const result = parseCycloneDXDocument(invalidDoc, {
        name: 'grype',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error!.code).toBe('INVALID_STRUCTURE');
      expect(result.error!.type).toBe('parse_error');
      expect(result.error!.details?.fields).toContainEqual(
        expect.objectContaining({
          field: 'bomFormat',
        })
      );
    });

    test('should reject document with wrong bomFormat value', () => {
      const invalidDoc = {
        bomFormat: 'SBOM',
        specVersion: '1.4',
        serialNumber: 'urn:uuid:123e4567-e89b-12d3-a456-426614174000',
        version: 1,
      };

      const result = parseCycloneDXDocument(invalidDoc, {
        name: 'grype',
      });

      expect(result.success).toBe(false);
      expect(result.error!.code).toBe('INVALID_STRUCTURE');
      expect(result.error!.details?.fields).toContainEqual(
        expect.objectContaining({
          field: 'bomFormat',
          reason: expect.stringContaining('CycloneDX'),
        })
      );
    });

    test('should reject document without specVersion', () => {
      const invalidDoc = {
        bomFormat: 'CycloneDX',
        serialNumber: 'urn:uuid:123e4567-e89b-12d3-a456-426614174000',
        version: 1,
      };

      const result = parseCycloneDXDocument(invalidDoc, {
        name: 'grype',
      });

      expect(result.success).toBe(false);
      expect(result.error!.details?.fields).toContainEqual(
        expect.objectContaining({
          field: 'specVersion',
        })
      );
    });

    test('should reject document with unsupported specVersion', () => {
      const invalidDoc = {
        bomFormat: 'CycloneDX',
        specVersion: '1.3',
        serialNumber: 'urn:uuid:123e4567-e89b-12d3-a456-426614174000',
        version: 1,
      };

      const result = parseCycloneDXDocument(invalidDoc, {
        name: 'grype',
      });

      expect(result.success).toBe(false);
      expect(result.error!.details?.fields).toContainEqual(
        expect.objectContaining({
          field: 'specVersion',
          reason: expect.stringContaining('Unsupported'),
        })
      );
    });

    test('should reject document without serialNumber', () => {
      const invalidDoc = {
        bomFormat: 'CycloneDX',
        specVersion: '1.4',
        version: 1,
      };

      const result = parseCycloneDXDocument(invalidDoc, {
        name: 'grype',
      });

      expect(result.success).toBe(false);
      expect(result.error!.details?.fields).toContainEqual(
        expect.objectContaining({
          field: 'serialNumber',
        })
      );
    });
  });

  describe('Component Parsing', () => {
    test('should parse components with all fields', () => {
      const doc = {
        bomFormat: 'CycloneDX',
        specVersion: '1.4',
        serialNumber: 'urn:uuid:123e4567-e89b-12d3-a456-426614174000',
        version: 1,
        components: [
          {
            name: 'django',
            version: '3.2.0',
            type: 'library',
            purl: 'pkg:pypi/django@3.2.0',
            licenses: [
              { expression: 'BSD-3-Clause' },
              { expression: 'MIT' },
            ],
            hashes: [
              {
                alg: 'SHA-256',
                content: 'abcd1234567890ef',
              },
            ],
          },
        ],
      };

      const result = parseCycloneDXDocument(doc, {
        name: 'grype',
      });

      expect(result.success).toBe(true);
      expect(result.data!.components).toHaveLength(1);
      const comp = result.data!.components[0];
      expect(comp.name).toBe('django');
      expect(comp.version).toBe('3.2.0');
      expect(comp.type).toBe('library');
      expect(comp.purl).toBe('pkg:pypi/django@3.2.0');
      expect(comp.licenses).toEqual(['BSD-3-Clause', 'MIT']);
      expect(comp.hashes).toEqual({
        'SHA-256': 'abcd1234567890ef',
      });
    });

    test('should skip components without name', () => {
      const doc = {
        bomFormat: 'CycloneDX',
        specVersion: '1.4',
        serialNumber: 'urn:uuid:123e4567-e89b-12d3-a456-426614174000',
        version: 1,
        components: [
          {
            version: '1.0.0',
            type: 'library',
          },
          {
            name: 'valid-component',
            version: '2.0.0',
            type: 'library',
          },
        ],
      };

      const result = parseCycloneDXDocument(doc, {
        name: 'grype',
      });

      expect(result.success).toBe(true);
      expect(result.data!.components).toHaveLength(1);
      expect(result.data!.components[0].name).toBe('valid-component');
    });

    test('should skip components without version', () => {
      const doc = {
        bomFormat: 'CycloneDX',
        specVersion: '1.4',
        serialNumber: 'urn:uuid:123e4567-e89b-12d3-a456-426614174000',
        version: 1,
        components: [
          {
            name: 'incomplete-component',
            type: 'library',
          },
          {
            name: 'complete-component',
            version: '1.0.0',
            type: 'library',
          },
        ],
      };

      const result = parseCycloneDXDocument(doc, {
        name: 'grype',
      });

      expect(result.success).toBe(true);
      expect(result.data!.components).toHaveLength(1);
      expect(result.data!.components[0].name).toBe('complete-component');
    });
  });

  describe('Vulnerability Parsing', () => {
    test('should parse vulnerabilities from vulnerabilities array', () => {
      const doc = {
        bomFormat: 'CycloneDX',
        specVersion: '1.4',
        serialNumber: 'urn:uuid:123e4567-e89b-12d3-a456-426614174000',
        version: 1,
        vulnerabilities: [
          {
            ref: 'urn:cdx:vuln:uuid:456',
            id: 'CVE-2021-12345',
            source: {
              id: 'CVE-2021-12345',
              url: 'https://nvd.nist.gov/vuln/detail/CVE-2021-12345',
            },
            ratings: [
              {
                severity: 'high',
                score: 8.5,
                vector: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:R/S:U/C:H/I:H/A:N',
              },
            ],
            description: 'Test vulnerability',
            cwes: [79, 80],
            references: [
              {
                url: 'https://example.com/ref1',
              },
            ],
          },
        ],
      };

      const result = parseCycloneDXDocument(doc, {
        name: 'trivy',
      });

      expect(result.success).toBe(true);
      expect(result.data!.vulnerabilities).toHaveLength(1);
      const vuln = result.data!.vulnerabilities[0];
      expect(vuln.cveId).toBe('CVE-2021-12345');
      expect(vuln.ratings[0].severity).toBe('high');
      expect(vuln.ratings[0].score).toBe(8.5);
      expect(vuln.cwes).toEqual([79, 80]);
      expect(vuln.references).toHaveLength(1);
    });

    test('should skip vulnerabilities without ref/id', () => {
      const doc = {
        bomFormat: 'CycloneDX',
        specVersion: '1.4',
        serialNumber: 'urn:uuid:123e4567-e89b-12d3-a456-426614174000',
        version: 1,
        vulnerabilities: [
          {
            source: { id: 'UNKNOWN' },
          },
          {
            ref: 'urn:cdx:vuln:uuid:789',
            id: 'CVE-2021-99999',
            source: { id: 'CVE-2021-99999' },
          },
        ],
      };

      const result = parseCycloneDXDocument(doc, {
        name: 'grype',
      });

      expect(result.success).toBe(true);
      expect(result.data!.vulnerabilities).toHaveLength(1);
      expect(result.data!.vulnerabilities[0].cveId).toBe('CVE-2021-99999');
    });
  });

  describe('Metadata Parsing', () => {
    test('should extract metadata with tools', () => {
      const doc = {
        bomFormat: 'CycloneDX',
        specVersion: '1.4',
        serialNumber: 'urn:uuid:123e4567-e89b-12d3-a456-426614174000',
        version: 1,
        metadata: {
          timestamp: '2025-04-16T10:00:00Z',
          tools: [
            {
              name: 'grype',
              version: '0.65.0',
            },
            {
              name: 'syft',
              version: '0.68.1',
            },
          ],
          component: {
            name: 'my-app',
            version: '1.0.0',
          },
        },
      };

      const result = parseCycloneDXDocument(doc, {
        name: 'grype',
      });

      expect(result.success).toBe(true);
      expect(result.data!.metadata.timestamp).toBe('2025-04-16T10:00:00Z');
      expect(result.data!.metadata.tools).toHaveLength(2);
      expect(result.data!.metadata.tools![0].name).toBe('grype');
      expect(result.data!.metadata.component?.name).toBe('my-app');
    });
  });

  describe('Error Handling', () => {
    test('should handle null input', () => {
      const result = parseCycloneDXDocument(null, {
        name: 'grype',
      });

      expect(result.success).toBe(false);
      expect(result.error!.type).toBe('parse_error');
      expect(result.error!.code).toBe('INVALID_STRUCTURE');
    });

    test('should handle undefined input', () => {
      const result = parseCycloneDXDocument(undefined, {
        name: 'grype',
      });

      expect(result.success).toBe(false);
      expect(result.error!.type).toBe('parse_error');
    });

    test('should handle non-object input', () => {
      const result = parseCycloneDXDocument('not an object', {
        name: 'grype',
      });

      expect(result.success).toBe(false);
      expect(result.error!.type).toBe('parse_error');
    });

    test('should handle array input', () => {
      const result = parseCycloneDXDocument([], {
        name: 'grype',
      });

      expect(result.success).toBe(false);
      expect(result.error!.type).toBe('parse_error');
    });

    test('should include context in error response', () => {
      const result = parseCycloneDXDocument({}, {
        name: 'snyk',
        version: '1.2.3',
      });

      expect(result.success).toBe(false);
      expect(result.error!.context.source).toBe('snyk');
      expect(result.error!.context.stage).toBe('parsing');
      expect(result.error!.context.timestamp).toBeDefined();
    });
  });

  describe('Edge Cases', () => {
    test('should handle missing optional metadata fields', () => {
      const doc = {
        bomFormat: 'CycloneDX',
        specVersion: '1.4',
        serialNumber: 'urn:uuid:123e4567-e89b-12d3-a456-426614174000',
        version: 1,
        // metadata, components, vulnerabilities all missing
      };

      const result = parseCycloneDXDocument(doc, {
        name: 'grype',
      });

      expect(result.success).toBe(true);
      expect(result.data!.components).toEqual([]);
      expect(result.data!.vulnerabilities).toEqual([]);
    });

    test('should handle empty components array', () => {
      const doc = {
        bomFormat: 'CycloneDX',
        specVersion: '1.4',
        serialNumber: 'urn:uuid:123e4567-e89b-12d3-a456-426614174000',
        version: 1,
        components: [],
      };

      const result = parseCycloneDXDocument(doc, {
        name: 'grype',
      });

      expect(result.success).toBe(true);
      expect(result.data!.components).toEqual([]);
    });

    test('should handle empty vulnerabilities array', () => {
      const doc = {
        bomFormat: 'CycloneDX',
        specVersion: '1.4',
        serialNumber: 'urn:uuid:123e4567-e89b-12d3-a456-426614174000',
        version: 1,
        vulnerabilities: [],
      };

      const result = parseCycloneDXDocument(doc, {
        name: 'grype',
      });

      expect(result.success).toBe(true);
      expect(result.data!.vulnerabilities).toEqual([]);
    });

    test('should handle multiple errors and report all', () => {
      const doc = {
        bomFormat: 'INVALID',
        specVersion: '2.0',
        // missing serialNumber
      };

      const result = parseCycloneDXDocument(doc, {
        name: 'grype',
      });

      expect(result.success).toBe(false);
      expect(result.error!.details?.fields?.length).toBeGreaterThan(1);
    });

    test('should handle extra unknown fields gracefully', () => {
      const doc = {
        bomFormat: 'CycloneDX',
        specVersion: '1.4',
        serialNumber: 'urn:uuid:123e4567-e89b-12d3-a456-426614174000',
        version: 1,
        unknownField1: 'should be ignored',
        unknownField2: { nested: 'data' },
        components: [],
      };

      const result = parseCycloneDXDocument(doc, {
        name: 'grype',
      });

      expect(result.success).toBe(true);
      expect(result.data!._raw).toBeDefined();
      // Raw document is preserved for audit
    });

    test('should use source metadata for traceability', () => {
      const doc = {
        bomFormat: 'CycloneDX',
        specVersion: '1.4',
        serialNumber: 'urn:uuid:123e4567-e89b-12d3-a456-426614174000',
        version: 1,
      };

      const result = parseCycloneDXDocument(doc, {
        name: 'clair',
        version: '4.5.0',
        timestamp: '2025-04-16T12:30:45Z',
      });

      expect(result.success).toBe(true);
      expect(result.data!._sourceDocument.scannerName).toBe('clair');
      expect(result.data!._sourceDocument.scannerVersion).toBe('4.5.0');
      expect(result.data!._sourceDocument.ingestTimestamp).toBe('2025-04-16T12:30:45Z');
    });
  });
});
