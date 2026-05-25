import { describe, it, expect } from "@jest/globals";
import {
  validateCycloneDX,
  parseCycloneDXDocument,
  unifyCycloneDXDocument,
  fromCycloneDX,
} from "../src/ingestion/cyclonedx-contracts";
import type {
  CycloneDXSpecVersion,
  ParsedCycloneDxDocument,
  ValidatedCycloneDxDocument,
  UnifiedVulnerability,
  UnifiedComponent,
  UnifiedScanPayload,
  IngestionError,
  IngestionResult,
} from "../src/ingestion/cyclonedx-contracts";

describe("PR-01: CycloneDX Contracts + DTO", () => {
  describe("Type Contracts - Compile and Exist", () => {
    it("should have all required type exports", () => {
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
            locations: [],
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
        processingTimeMs: 12,
      };

      expect(result.status).toBe("rejected");
      if (result.status === "rejected") {
        expect(result.error.type).toBe("validation_error");
      }
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

  describe("validateCycloneDX", () => {
    it("handles valid JSON string, valid object, and invalid document formats", () => {
      const validDoc = {
        bomFormat: "CycloneDX",
        specVersion: "1.6",
        version: 1,
        components: [
          {
            name: "lodash",
            version: "4.17.21",
          },
        ],
      };

      // Valid object
      const resObj = validateCycloneDX(validDoc);
      expect(resObj.valid).toBe(true);
      expect(resObj.spec_version).toBe("1.6");

      // Valid string
      const resStr = validateCycloneDX(JSON.stringify(validDoc));
      expect(resStr.valid).toBe(true);

      // Invalid JSON string
      const resInvalidJson = validateCycloneDX("{ invalid-json");
      expect(resInvalidJson.valid).toBe(false);
      expect(resInvalidJson.spec_version).toBe("unknown");
      expect(resInvalidJson.errors[0]).toContain("Invalid JSON");

      // Invalid document root (non-object)
      const resInvalidRoot = validateCycloneDX(42 as any);
      expect(resInvalidRoot.valid).toBe(false);
      expect(resInvalidRoot.errors[0]).toContain("must be a JSON object");

      // Missing required properties
      const resMissing = validateCycloneDX({ bomFormat: "CycloneDX" } as any);
      expect(resMissing.valid).toBe(false);
      expect(resMissing.errors.length).toBeGreaterThan(0);
    });
  });

  describe("parseCycloneDXDocument and helpers", () => {
    it("parses valid and handles edge cases for components, licenses, vulnerabilities", () => {
      const raw = {
        bomFormat: "CycloneDX",
        specVersion: "1.5",
        version: "2", // will be converted to number 2
        serialNumber: "urn:uuid:serial-number",
        metadata: {
          timestamp: "2024-05-01T00:00:00Z",
          tools: [{ name: "syft", version: "1.0.0" }],
          extraMetadataField: "extra-metadata-val",
        },
        components: [
          {
            // Valid component with bomRef, cpe, purl, licenses, properties, supplier
            "bom-ref": "pkg:npm/foo@1.0.0",
            name: "foo",
            version: "1.0.0",
            type: "library",
            purl: "pkg:npm/foo@1.0.0",
            cpe: "cpe:2.3:a:foo:foo:1.0.0",
            supplier: "Foo Corp",
            licenses: [
              { license: { id: "MIT", name: "MIT License" } },
              { license: { id: "Apache-2.0" } },
              { license: { name: "Custom" } },
              { license: {} }, // Invalid license object, no id/name
              "not-an-object", // Invalid structure
            ],
            properties: [
              { name: "syft:location:path", value: "/app/package.json" },
              { name: "syft:package:foundBy", value: "npm-cli" },
              { name: "invalid-property", value: 123 as any }, // Invalid property value type
            ],
            extraComponentField: "extra-component-val",
          },
          {
            // Component missing name -> should be skipped/filtered
            version: "2.0.0",
          },
          "not-a-component-object", // Should be filtered out
        ],
        vulnerabilities: [
          {
            id: "CVE-2024-0001",
            ref: "vuln-ref-1",
            description: "A vulnerability description",
            ratings: [
              {
                severity: "HIGH",
                score: 8.5,
                vector: "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H",
                source: { name: "NVD" },
              },
              {
                severity: "CRITICAL",
                score: 9.8,
              },
              "invalid-rating-object", // filtered
            ],
            cwes: [{ id: "CWE-79" }, "invalid-cwe"],
            fixes: [{ version: "1.0.1" }, "invalid-fix"],
            references: [{ url: "http://ref1", category: "advisory" }, "invalid-ref"],
            affects: [{ ref: "pkg:npm/foo@1.0.0" }, "invalid-affect"],
            extraVulnerabilityField: "extra-vuln-val",
          },
          "not-a-vulnerability-object", // Should be filtered
        ],
        dependencies: [
          { ref: "pkg:npm/foo@1.0.0", dependsOn: ["pkg:npm/bar@1.0.0"] },
          "invalid-dependency", // filtered
        ],
        extraTopLevelField: "extra-top-level-val",
      };

      const parsed = parseCycloneDXDocument(raw);

      expect(parsed.bomFormat).toBe("CycloneDX");
      expect(parsed.specVersion).toBe("1.5");
      expect(parsed.version).toBe(2);
      expect(parsed.serialNumber).toBe("urn:uuid:serial-number");
      expect(parsed.metadata?.timestamp).toBe("2024-05-01T00:00:00Z");

      // Components
      expect(parsed.components).toHaveLength(1);
      const comp = parsed.components[0];
      expect(comp.name).toBe("foo");
      expect(comp.bomRef).toBe("pkg:npm/foo@1.0.0");
      expect(comp.supplier).toBe("Foo Corp");
      expect(comp.licenses).toHaveLength(3); // 3 valid licenses
      expect(comp.licenses[0].license?.id).toBe("MIT");
      expect(comp.properties).toHaveLength(2); // 2 valid properties

      // Vulnerabilities
      expect(parsed.vulnerabilities).toHaveLength(1);
      const vuln = parsed.vulnerabilities[0];
      expect(vuln.id).toBe("CVE-2024-0001");
      expect(vuln.ratings).toHaveLength(2);
      expect(vuln.cwes).toHaveLength(1);
      expect(vuln.fixes).toHaveLength(1);
      expect(vuln.references).toHaveLength(1);
      expect(vuln.affects).toHaveLength(1);

      // Dependencies
      expect(parsed.dependencies).toHaveLength(1);

      // Raw fields clone (should contain extraTopLevelField)
      expect(parsed._rawFields).toBeDefined();
      expect(parsed._rawFields?.extraTopLevelField).toBe("extra-top-level-val");
    });

    it("handles ratings severity and score levels normalization correctly", () => {
      const getNormalizedSeverity = (rating: any) => {
        const doc = {
          bomFormat: "CycloneDX" as const,
          specVersion: "1.6" as CycloneDXSpecVersion,
          version: 1,
          components: [],
          vulnerabilities: [
            {
              id: "CVE-TEST",
              ratings: [rating],
            },
          ],
        };
        const parsed = parseCycloneDXDocument(doc);
        const unified = unifyCycloneDXDocument(parsed as any);
        return unified.vulnerabilities[0].severity.level;
      };

      // Severity string mapping
      expect(getNormalizedSeverity({ severity: "critical" })).toBe("critical");
      expect(getNormalizedSeverity({ severity: "HIGH" })).toBe("high");
      expect(getNormalizedSeverity({ severity: "medium" })).toBe("medium");
      expect(getNormalizedSeverity({ severity: "Low" })).toBe("low");
      expect(getNormalizedSeverity({ severity: "info" })).toBe("info");

      // Score-based mapping (when severity is missing or invalid)
      expect(getNormalizedSeverity({ score: 9.5 })).toBe("critical");
      expect(getNormalizedSeverity({ score: 7.2 })).toBe("high");
      expect(getNormalizedSeverity({ score: 5.0 })).toBe("medium");
      expect(getNormalizedSeverity({ score: 2.1 })).toBe("low");
      expect(getNormalizedSeverity({ score: 0 })).toBe("info");

      // Score missing / invalid -> fallback info
      expect(getNormalizedSeverity({ severity: "unknown-severity" })).toBe("info");
    });
  });

  describe("unifyCycloneDXDocument and helpers", () => {
    it("unifies components and vulnerabilities correctly with affects resolution and unknown fields", () => {
      const validated: ValidatedCycloneDxDocument = {
        bomFormat: "CycloneDX",
        specVersion: "1.6",
        version: 1,
        _validation: {
          schemaVersion: "1.6",
          isValid: true,
          issues: [],
          validatedAt: new Date(),
        },
        metadata: {
          timestamp: "2024-05-01T00:00:00Z",
          tools: [{ name: "syft", version: "1.0.0" }],
          extraMetadata: "extra-metadata-value",
        },
        components: [
          {
            bomRef: "pkg:npm/lodash@4.17.21",
            type: "library",
            name: "lodash",
            version: "4.17.21",
            purl: "pkg:npm/lodash@4.17.21",
            licenses: [{ license: { id: "MIT" } }],
            properties: [
              { name: "syft:location:path", value: "/package-lock.json" },
              { name: "syft:package:foundBy", value: "syft-cli" },
              { name: "extra-property", value: "val" },
            ],
            extraComponentField: "extra-component-val",
          },
          {
            // Component with no explicit bomRef -> fallback resolves via name/version or purl
            name: "fallback-lib",
            version: "1.0.0",
            purl: "pkg:npm/fallback-lib@1.0.0",
            licenses: [{ id: "BSD-3-Clause" } as any], // Direct license instead of { license }
          },
        ],
        vulnerabilities: [
          {
            id: "GHSA-lodash-vuln",
            ratings: [{ score: 8.0, severity: "high", source: { name: "GitHub" } }],
            fixes: [{ version: "4.17.22" }],
            references: [{ url: "https://github.com/advisory" }],
            affects: [{ ref: "pkg:npm/lodash@4.17.21" }],
          },
          {
            id: "CVE-fallback-vuln",
            ratings: [{ score: 4.5, severity: "medium", source: { name: "NVD" } }],
            affects: [{ ref: "pkg:npm/fallback-lib@1.0.0" }],
          },
        ],
        _rawFields: {
          extraTopField: "extra-top-value",
        },
      };

      const context = {
        scanId: "scan-999",
        scannerId: "syft-scanner",
        ingestedAt: new Date("2026-05-25T12:00:00Z"),
      };

      const unified = unifyCycloneDXDocument(validated, context);

      expect(unified.scanId).toBe("scan-999");
      expect(unified.scannerId).toBe("syft-scanner");
      expect(unified.scanTime).toEqual(context.ingestedAt);

      // Component unification & mapping
      expect(unified.components).toHaveLength(2);

      const lodash = unified.components.find((c) => c.name === "lodash")!;
      expect(lodash.bomRef).toBe("pkg:npm/lodash@4.17.21");
      expect(lodash.locations).toEqual(["/package-lock.json"]);
      expect(lodash.foundBy).toBe("syft-cli");
      expect(lodash.vulnerabilities).toHaveLength(1);
      expect(lodash.vulnerabilities[0].identifiers.id).toBe("GHSA-lodash-vuln");
      expect(lodash.vulnerabilities[0].identifiers.ghsa).toBe("GHSA-lodash-vuln");
      expect(lodash.vulnerabilities[0].fixedVersions).toEqual(["4.17.22"]);

      const fallback = unified.components.find((c) => c.name === "fallback-lib")!;
      expect(fallback.vulnerabilities).toHaveLength(1);
      expect(fallback.vulnerabilities[0].identifiers.id).toBe("CVE-fallback-vuln");
      expect(fallback.vulnerabilities[0].identifiers.osv).toBe("CVE-fallback-vuln");

      // Stats
      expect(unified.stats.componentCount).toBe(2);
      expect(unified.stats.vulnerabilityCount).toBe(2);
      expect(unified.stats.severityCounts).toEqual({
        high: 1,
        medium: 1,
      });

      // Unknown fields mapping
      expect(unified._unknownFields.get("$.extraTopField")).toBe("extra-top-value");
      expect(unified._unknownFields.get("$.metadata.extraMetadata")).toBe("extra-metadata-value");
      expect(unified._unknownFields.get("$.components[0].extraComponentField")).toBe("extra-component-val");
    });
  });

  describe("fromCycloneDX Integration Flow", () => {
    it("runs successfully for valid CycloneDX, and handles failure flows", () => {
      const validDoc = {
        bomFormat: "CycloneDX",
        specVersion: "1.6",
        version: 1,
        components: [
          {
            name: "lodash",
            version: "4.17.21",
          },
        ],
        vulnerabilities: [],
      };

      // 1. Success case
      const resSuccess = fromCycloneDX(validDoc, { scanId: "scan-success", scannerId: "grype" });
      expect(resSuccess.status).toBe("ingested");
      if (resSuccess.status === "ingested") {
        expect(resSuccess.scanId).toBe("scan-success");
        expect(resSuccess.payload.stats.componentCount).toBe(1);
        expect(resSuccess.processingTimeMs).toBeGreaterThanOrEqual(0);
      }

      // 2. Validation failure case
      const invalidDoc = {
        bomFormat: "CycloneDX",
        // missing specVersion
        version: 1,
        components: [],
      };

      const resValFail = fromCycloneDX(invalidDoc as any, { scanId: "scan-fail" });
      expect(resValFail.status).toBe("rejected");
      if (resValFail.status === "rejected") {
        expect(resValFail.stage).toBe("validation");
        expect(resValFail.error.code).toBe("cyclonedx_validation_failed");
        expect(resValFail.error.details?.errors).toBeDefined();
      }

      const resParseFail = fromCycloneDX(null as any, { scanId: "scan-fail-2" });
      expect(resParseFail.status).toBe("rejected");
      if (resParseFail.status === "rejected") {
        expect(resParseFail.stage).toBe("validation");
        expect(resParseFail.error.code).toBe("cyclonedx_validation_failed");
      }

      // 4. Simulated unification/parsing failure via throwing getter
      const throwingDoc = {
        bomFormat: "CycloneDX" as const,
        specVersion: "1.6" as CycloneDXSpecVersion,
        version: 1,
        components: [],
        vulnerabilities: [],
        get myExtraProperty() {
          throw new Error("Simulated unification failure");
        },
      };

      const resThrowing = fromCycloneDX(throwingDoc, { scanId: "scan-fail-3" });
      expect(resThrowing.status).toBe("rejected");
      if (resThrowing.status === "rejected") {
        expect(resThrowing.stage).toBe("unification");
        expect(resThrowing.error.code).toBe("cyclonedx_ingestion_failed");
        expect(resThrowing.error.message).toContain("Simulated unification failure");
      }
    });
  });
});
