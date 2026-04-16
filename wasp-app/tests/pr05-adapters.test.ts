/**
 * PR-05: Scanner Adapters - Test Suite
 * 
 * Tests for converting scanner-specific formats to CycloneDX
 */

import { describe, it, expect } from "@jest/globals";
import {
  GrypeAdapter,
  TrivyAdapter,
  SnykAdapter,
  OSVAdapter,
  AdapterRegistry,
} from "../src/ingestion/adapters";

describe("PR-05: Scanner Adapters", () => {
  describe("GrypeAdapter", () => {
    const adapter = new GrypeAdapter();

    it("should adapt valid Grype output", () => {
      const output = {
        matches: [
          {
            vulnerability: {
              id: "CVE-2021-1234",
              severity: "high",
              dataSource: "nvd",
              cvssScore: 7.5,
            },
            artifact: {
              name: "express",
              version: "1.0.0",
              type: "npm",
            },
          },
        ],
      };

      const result = adapter.adapt(output);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.document.bomFormat).toBe("CycloneDX");
        expect(result.document.components).toHaveLength(1);
        expect(result.document.vulnerabilities).toHaveLength(1);
      }
    });

    it("should handle string input", () => {
      const str = JSON.stringify({
        matches: [
          {
            vulnerability: { id: "CVE-2021-5678", severity: "medium" },
            artifact: { name: "pkg", version: "2.0.0" },
          },
        ],
      });

      const result = adapter.adapt(str);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.document.components).toHaveLength(1);
      }
    });

    it("should deduplicate components", () => {
      const output = {
        matches: [
          {
            vulnerability: { id: "CVE-1", severity: "high" },
            artifact: { name: "pkg", version: "1.0.0" },
          },
          {
            vulnerability: { id: "CVE-2", severity: "low" },
            artifact: { name: "pkg", version: "1.0.0" },
          },
        ],
      };

      const result = adapter.adapt(output);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.document.components).toHaveLength(1);
        expect(result.document.vulnerabilities).toHaveLength(2);
      }
    });
  });

  describe("TrivyAdapter", () => {
    const adapter = new TrivyAdapter();

    it("should adapt valid Trivy output", () => {
      const output = {
        Results: [
          {
            Vulnerabilities: [
              {
                VulnerabilityID: "CVE-2021-9999",
                PkgName: "curl",
                PkgVersion: "7.68.0",
                Severity: "HIGH",
                CVSS: { nvd: { V3Score: 8.5 } },
              },
            ],
          },
        ],
      };

      const result = adapter.adapt(output);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.document.bomFormat).toBe("CycloneDX");
        expect(result.document.vulnerabilities[0].ratings[0].severity).toBe("high");
      }
    });

    it("should map severity levels", () => {
      const output = {
        Results: [
          {
            Vulnerabilities: [
              { VulnerabilityID: "CVE-1", PkgName: "pkg", PkgVersion: "1.0", Severity: "CRITICAL" },
              { VulnerabilityID: "CVE-2", PkgName: "pkg", PkgVersion: "1.0", Severity: "LOW" },
            ],
          },
        ],
      };

      const result = adapter.adapt(output);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.document.vulnerabilities[0].ratings[0].severity).toBe("critical");
        expect(result.document.vulnerabilities[1].ratings[0].severity).toBe("low");
      }
    });
  });

  describe("SnykAdapter", () => {
    const adapter = new SnykAdapter();

    it("should adapt valid Snyk output", () => {
      const output = {
        vulnerabilities: [
          {
            name: "CVE-2021-3456",
            package: "lodash",
            version: "4.17.20",
            severity: "critical",
            cvssScore: 9.8,
          },
        ],
      };

      const result = adapter.adapt(output);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.document.vulnerabilities[0].ratings[0].severity).toBe("critical");
      }
    });
  });

  describe("OSVAdapter", () => {
    const adapter = new OSVAdapter();

    it("should adapt valid OSV output", () => {
      const output = {
        results: [
          {
            packages: [
              {
                package: { name: "numpy", version: "1.19.0" },
                vulnerabilities: [
                  {
                    id: "GHSA-1234-5678-90ab",
                    severity: { type: "CVSS_V3", score: 7.2 },
                  },
                ],
              },
            ],
          },
        ],
      };

      const result = adapter.adapt(output);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.document.components).toHaveLength(1);
        expect(result.document.vulnerabilities).toHaveLength(1);
      }
    });
  });

  describe("AdapterRegistry", () => {
    it("should register adapters", () => {
      const registry = new AdapterRegistry();
      expect(registry.getAdapter("grype")).toBeDefined();
      expect(registry.getAdapter("trivy")).toBeDefined();
      expect(registry.getAdapter("snyk")).toBeDefined();
      expect(registry.getAdapter("osv-scanner")).toBeDefined();
    });

    it("should list scanners", () => {
      const registry = new AdapterRegistry();
      const scanners = registry.listScanners();
      expect(scanners).toContain("grype");
      expect(scanners).toContain("trivy");
      expect(scanners.length).toBe(4);
    });

    it("should dispatch to correct adapter", () => {
      const registry = new AdapterRegistry();
      const result = registry.adapt("grype", { matches: [] });
      expect(result.success).toBe(true);
    });

    it("should return error for unknown scanner", () => {
      const registry = new AdapterRegistry();
      const result = registry.adapt("unknown-scanner", {});
      expect(result.success).toBe(false);
      if (result.success === false) {
        expect(result.error).toContain("Unknown scanner");
      }
    });
  });

  describe("Edge Cases", () => {
    it("should handle invalid CVSS scores", () => {
      const adapter = new GrypeAdapter();
      const output = {
        matches: [
          {
            vulnerability: { id: "CVE-1", severity: "high", cvssScore: -5 },
            artifact: { name: "pkg", version: "1.0" },
          },
        ],
      };

      const result = adapter.adapt(output);
      expect(result.success).toBe(true);
    });

    it("should handle JSON parse errors", () => {
      const adapter = new GrypeAdapter();
      const result = adapter.adapt("invalid json {");
      expect(result.success).toBe(false);
      if (result.success === false) {
        expect(result.error).toBeTruthy();
      }
    });

    it("should generate CycloneDX structure", () => {
      const adapter = new GrypeAdapter();
      const result = adapter.adapt({ matches: [] });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.document.bomFormat).toBe("CycloneDX");
        expect(result.document.specVersion).toBe("1.5");
        expect(result.document.serialNumber).toMatch(/urn:uuid:/);
        expect(result.document.metadata?.tools).toBeDefined();
      }
    });
  });
});
