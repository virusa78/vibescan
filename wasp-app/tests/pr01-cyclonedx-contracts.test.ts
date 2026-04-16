/**
 * PR-01 Tests: CycloneDX Contracts + DTO
 * 
 * Validates that all type contracts compile and are properly structured
 */

import { describe, it, expect } from "@jest/globals";
import type {
  CycloneDXSpecVersion,
  RawCycloneDXDocument,
  ParsedCycloneDxDocument,
  ValidatedCycloneDxDocument,
  UnifiedVulnerability,
  UnifiedComponent,
  UnifiedScanPayload,
  IngestionError,
  IngestionContext,
  IngestionResult,
} from "../src/ingestion/cyclonedx-contracts";

describe("PR-01: CycloneDX Contracts + DTO", () => {
  describe("Type Contracts - Compile and Exist", () => {
    it("should have all required type exports", () => {
      // This test validates that TypeScript compilation succeeds
      // and all core types are properly exported

      expect(true).toBe(true);
    });
  });

  describe("ParsedCycloneDxDocument", () => {
    it("should accept valid parsed document structure", () => {
      const parsed: ParsedCycloneDxDocument = {
        bomFormat: "CycloneDX",
        specVersion: "1.6",
        serialNumber: "urn:uuid:test-123",
        version: 1,
        components: [
          {
            bomRef: "pkg:npm/lodash@4.17.21",
            type: "library",
            name: "lodash",
            version: "4.17.21",
            purl: "pkg:npm/lodash@4.17.21",
          },
        ],
        vulnerabilities: [
          {
            ref: "vuln-1",
            id: "CVE-2021-23337",
            source: { name: "NVD", url: "https://nvd.nist.gov" },
            ratings: [{ score: 6.1, severity: "medium" }],
            cwes: [{ id: "CWE-1234" }],
            fixes: [{ version: "4.17.21" }],
            references: [{ url: "https://nvd.nist.gov/vuln/detail/CVE-2021-23337" }],
          },
        ],
      };

      expect(parsed.bomFormat).toBe("CycloneDX");
      expect(parsed.specVersion).toBe("1.6");
      expect(parsed.components).toHaveLength(1);
      expect(parsed.vulnerabilities).toHaveLength(1);
    });

    it("should support optional fields in components", () => {
      const parsed: ParsedCycloneDxDocument = {
        bomFormat: "CycloneDX",
        specVersion: "1.5",
        serialNumber: "urn:uuid:test",
        version: 1,
        components: [
          {
            bomRef: "minimal",
            type: "library",
            name: "test-lib",
            version: "1.0.0",
            // licenses, cpe, purl, properties all optional
          },
        ],
        vulnerabilities: [],
      };

      expect(parsed.components[0].licenses).toBeUndefined();
      expect(parsed.components[0].cpe).toBeUndefined();
    });
  });

  describe("ValidatedCycloneDxDocument", () => {
    it("should include validation metadata", () => {
      const validated: ValidatedCycloneDxDocument = {
        bomFormat: "CycloneDX",
        specVersion: "1.6",
        serialNumber: "urn:uuid:validated",
        version: 1,
        components: [],
        vulnerabilities: [],
        _validation: {
          schemaVersion: "1.6",
          isValid: true,
          issues: [],
          validatedAt: new Date(),
        },
      };

      expect(validated._validation.isValid).toBe(true);
      expect(validated._validation.issues).toHaveLength(0);
    });

    it("should track validation issues with path and severity", () => {
      const validated: ValidatedCycloneDxDocument = {
        bomFormat: "CycloneDX",
        specVersion: "1.6",
        serialNumber: "urn:uuid:invalid",
        version: 1,
        components: [],
        vulnerabilities: [],
        _validation: {
          schemaVersion: "1.6",
          isValid: false,
          issues: [
            {
              path: "$.components[0].name",
              code: "required_field",
              message: "Component name is required",
              severity: "error",
            },
            {
              path: "$.metadata.timestamp",
              code: "invalid_format",
              message: "Timestamp should be ISO 8601",
              severity: "warning",
            },
          ],
          validatedAt: new Date(),
        },
      };

      expect(validated._validation.isValid).toBe(false);
      expect(validated._validation.issues).toHaveLength(2);
      expect(validated._validation.issues[0].severity).toBe("error");
      expect(validated._validation.issues[1].severity).toBe("warning");
    });
  });

  describe("UnifiedVulnerability", () => {
    it("should normalize severity with CVSS", () => {
      const vuln: UnifiedVulnerability = {
        identifiers: {
          id: "CVE-2021-23337",
          ghsa: "GHSA-35jh-r3h4-6jhm",
          osv: "GHSA-35jh-r3h4-6jhm",
        },
        severity: {
          level: "high",
          cvssScore: 7.5,
          cvssVector: "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:N/A:N",
          cvssVersion: "3.1",
        },
        cwes: [{ id: "CWE-94", name: "Improper Control of Generation of Code" }],
        fixedVersions: ["4.17.21"],
        references: [
          { url: "https://nvd.nist.gov/vuln/detail/CVE-2021-23337", category: "advisory" },
        ],
        description: "Lodash had a vulnerability in the template engine",
      };

      expect(vuln.severity.level).toBe("high");
      expect(vuln.severity.cvssScore).toBe(7.5);
      expect(vuln.identifiers.id).toBe("CVE-2021-23337");
    });

    it("should track traceability to source document", () => {
      const vuln: UnifiedVulnerability = {
        identifiers: { id: "CVE-2024-1234" },
        severity: { level: "medium" },
        cwes: [],
        fixedVersions: [],
        references: [],
        _sourceDocument: "grype",
        _sourceId: "CVE-2024-1234",
        _rawFields: { customField: "customValue" },
      };

      expect(vuln._sourceDocument).toBe("grype");
      expect(vuln._rawFields?.customField).toBe("customValue");
    });
  });

  describe("UnifiedComponent", () => {
    it("should normalize component with all identifiers", () => {
      const component: UnifiedComponent = {
        bomRef: "pkg:npm/express@4.18.1",
        type: "library",
        name: "express",
        version: "4.18.1",
        purl: "pkg:npm/express@4.18.1",
        cpe: "cpe:2.3:a:expressjs:express:4.18.1:*:*:*:*:*:*:*",
        licenses: [{ id: "MIT" }],
        foundBy: "npm-lock-cataloger",
        locations: ["/package-lock.json"],
        vulnerabilities: [],
      };

      expect(component.name).toBe("express");
      expect(component.licenses).toHaveLength(1);
      expect(component.locations).toContain("/package-lock.json");
    });
  });

  describe("UnifiedScanPayload", () => {
    it("should aggregate components and vulnerabilities with stats", () => {
      const payload: UnifiedScanPayload = {
        scanId: "scan-123",
        scannerId: "grype",
        scanTime: new Date(),
        components: [
          {
            bomRef: "pkg:npm/lib1",
            type: "library",
            name: "lib1",
            version: "1.0.0",
            licenses: [],
            vulnerabilities: [],
          },
        ],
        vulnerabilities: [
          {
            identifiers: { id: "CVE-2024-1" },
            severity: { level: "high" },
            cwes: [],
            fixedVersions: [],
            references: [],
          },
          {
            identifiers: { id: "CVE-2024-2" },
            severity: { level: "medium" },
            cwes: [],
            fixedVersions: [],
            references: [],
          },
        ],
        stats: {
          componentCount: 1,
          vulnerabilityCount: 2,
          severityCounts: { high: 1, medium: 1 },
        },
        _originalDocument: {
          bomFormat: "CycloneDX",
          specVersion: "1.6",
          serialNumber: "urn:uuid:test",
          version: 1,
          components: [],
          vulnerabilities: [],
          _validation: {
            schemaVersion: "1.6",
            isValid: true,
            issues: [],
            validatedAt: new Date(),
          },
        },
        _unknownFields: new Map([["customField", 5]]),
      };

      expect(payload.stats.componentCount).toBe(1);
      expect(payload.stats.vulnerabilityCount).toBe(2);
      expect(payload.stats.severityCounts.high).toBe(1);
      expect(payload._unknownFields.get("customField")).toBe(5);
    });
  });

  describe("IngestionError", () => {
    it("should standardize error format across stages", () => {
      const parseError: IngestionError = {
        type: "parse_error",
        code: "parse_json_failed",
        message: "Invalid JSON in BOM document",
        details: { path: "$", expected: "JSON object", actual: "invalid JSON" },
        context: { scanId: "scan-1", scannerId: "grype", stage: "parsing" },
        timestamp: new Date(),
      };

      expect(parseError.type).toBe("parse_error");
      expect(parseError.context?.stage).toBe("parsing");

      const validationError: IngestionError = {
        type: "validation_error",
        code: "missing_required_field",
        message: "BOM format is required",
        details: { path: "$.bomFormat" },
        context: { stage: "validation" },
        timestamp: new Date(),
      };

      expect(validationError.type).toBe("validation_error");
      expect(validationError.code).toBe("missing_required_field");
    });
  });

  describe("IngestionResult", () => {
    it("should represent successful ingestion", () => {
      const result: IngestionResult = {
        scanId: "scan-success",
        status: "ingested",
        payload: {
          scanId: "scan-success",
          scannerId: "grype",
          scanTime: new Date(),
          components: [],
          vulnerabilities: [],
          stats: { componentCount: 0, vulnerabilityCount: 0, severityCounts: {} },
          _originalDocument: {
            bomFormat: "CycloneDX",
            specVersion: "1.6",
            serialNumber: "urn:uuid:success",
            version: 1,
            components: [],
            vulnerabilities: [],
            _validation: {
              schemaVersion: "1.6",
              isValid: true,
              issues: [],
              validatedAt: new Date(),
            },
          },
          _unknownFields: new Map(),
        },
        processingTimeMs: 42,
      };

      expect(result.status).toBe("ingested");
      expect(result.scanId).toBe("scan-success");
    });

    it("should represent failed ingestion with error details", () => {
      const result: IngestionResult = {
        scanId: "scan-failed",
        status: "rejected",
        error: {
          type: "validation_error",
          code: "invalid_spec_version",
          message: "Unsupported CycloneDX version 2.0",
          context: { stage: "validation" },
          timestamp: new Date(),
        },
        stage: "validation",
      };

      expect(result.status).toBe("rejected");
      expect(result.error.type).toBe("validation_error");
    });
  });

  describe("CycloneDX Spec Versions", () => {
    it("should accept all supported spec versions", () => {
      const versions: CycloneDXSpecVersion[] = ["1.4", "1.5", "1.6"];

      for (const version of versions) {
        const doc: ParsedCycloneDxDocument = {
          bomFormat: "CycloneDX",
          specVersion: version,
          serialNumber: "urn:uuid:test",
          version: 1,
          components: [],
          vulnerabilities: [],
        };

        expect(doc.specVersion).toBe(version);
      }
    });
  });
});
