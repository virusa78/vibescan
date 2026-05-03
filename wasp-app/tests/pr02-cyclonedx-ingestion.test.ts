import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { mkdtempSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { execFileSync } from "child_process";
import { describe, expect, it, jest } from "./testGlobals";
import type { ParsedCycloneDxDocument } from "../src/ingestion/cyclonedx-contracts";

jest.mock("wasp/server", () => {
  class HttpError extends Error {
    statusCode: number;
    details?: Record<string, unknown>;

    constructor(statusCode: number, message: string, details?: Record<string, unknown>) {
      super(message);
      this.statusCode = statusCode;
      this.details = details;
    }
  }

  return { HttpError };
});

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { fromCycloneDX, validateCycloneDX } = require("../src/ingestion/cyclonedx-contracts");
const {
  extractZipAndScanWithSyft,
  normalizeComponents,
  resolveTrustedScanInputPath,
  validateAndExtractSBOM,
// eslint-disable-next-line @typescript-eslint/no-require-imports
} = require("../src/server/services/inputAdapterService");

const repoRoot = join(process.cwd(), "..");
const sampleSbomPath = join(repoRoot, "test", "fixtures", "sample.sbom.json");
const cyclonePath = join(repoRoot, "cyclone.json");

describe("PR-02: CycloneDX ingestion runtime", () => {
  it("validates the committed CycloneDX fixtures", () => {
    const sampleSbom = readFileSync(sampleSbomPath, "utf8");
    const cyclone = readFileSync(cyclonePath, "utf8");

    expect(validateCycloneDX(sampleSbom).valid).toBe(true);
    expect(validateCycloneDX(cyclone).valid).toBe(true);
  });

  it("rejects CycloneDX documents missing required raw fields", () => {
    const invalid = {
      bomFormat: "CycloneDX",
      version: 1,
      components: [],
      vulnerabilities: [],
    };

    const validation = validateCycloneDX(invalid);

    expect(validation.valid).toBe(false);
    expect(validation.errors.join(" ")).toContain("specVersion");
  });

  it("keeps sbom and zip inputs inside the trusted scan root", () => {
    const originalRoot = process.env.VIBESCAN_SCAN_INPUT_DIR;
    const tempDir = mkdtempSync(join(tmpdir(), "vibescan-scan-inputs-"));
    const safeDir = join(tempDir, "uploads");
    mkdirSync(safeDir, { recursive: true });

    try {
      process.env.VIBESCAN_SCAN_INPUT_DIR = safeDir;

      const safeFile = join(safeDir, "sample.sbom.json");
      writeFileSync(safeFile, readFileSync(sampleSbomPath, "utf8"));

      expect(resolveTrustedScanInputPath("sample.sbom.json")).toBe(safeFile);

      const escapedPath = join(tmpdir(), "escape.sbom.json");
      expect(() => resolveTrustedScanInputPath(escapedPath)).toThrow(/unsafe_input_reference/i);
    } finally {
      if (originalRoot === undefined) {
        delete process.env.VIBESCAN_SCAN_INPUT_DIR;
      } else {
        process.env.VIBESCAN_SCAN_INPUT_DIR = originalRoot;
      }

      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("ingests and links vulnerabilities to matching components", () => {
    const document: ParsedCycloneDxDocument = {
      bomFormat: "CycloneDX",
      specVersion: "1.6",
      serialNumber: "urn:uuid:test-ingest",
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
          id: "CVE-2024-9999",
          ratings: [{ score: 7.8, severity: "high" }],
          affects: [{ ref: "pkg:npm/lodash@4.17.21" }],
          references: [{ url: "https://example.com/advisory", category: "advisory" }],
          fixes: [{ version: "4.17.21" }],
        },
      ],
    };

    const result = fromCycloneDX(document, {
      scanId: "scan-123",
      scannerId: "cyclonedx",
    });

    expect(result.status).toBe("ingested");
    if (result.status === "ingested") {
      expect(result.payload.stats.componentCount).toBe(1);
      expect(result.payload.stats.vulnerabilityCount).toBe(1);
      expect(result.payload.components[0].vulnerabilities).toHaveLength(1);
      expect(result.payload.vulnerabilities[0].severity.level).toBe("high");
    }
  });

  it("deduplicates normalized components and drops versionless entries", async () => {
    const normalized = await normalizeComponents([
      {
        name: "lodash",
        version: "4.17.21",
        purl: "pkg:npm/lodash@4.17.21",
        type: "library",
      },
      {
        name: "lodash",
        version: "4.17.21",
        purl: "pkg:npm/lodash@4.17.21",
        type: "library",
      },
      {
        name: "versionless",
        version: "unknown",
      },
    ]);

    expect(normalized).toHaveLength(1);
    expect(normalized[0]).toMatchObject({
      name: "lodash",
      version: "4.17.21",
      purl: "pkg:npm/lodash@4.17.21",
    });
  });

  it("extracts SBOM components through the adapter contract", () => {
    const rawSbom = JSON.stringify({
      bomFormat: "CycloneDX",
      specVersion: "1.6",
      version: 1,
      components: [
        { name: "express", version: "4.18.0", purl: "pkg:npm/express@4.18.0" },
        { name: "express", version: "4.18.0", purl: "pkg:npm/express@4.18.0" },
      ],
      vulnerabilities: [],
    });

    const extracted = validateAndExtractSBOM(rawSbom);

    expect(extracted.totalComponents).toBe(2);
    expect(extracted.components[0].name).toBe("express");
  });

  it("rejects ZIP archives with path traversal entries", async () => {
    const tempDir = mkdtempSync(join(tmpdir(), "vibescan-zip-test-"));
    const zipPath = join(tempDir, "malicious.zip");

    try {
      execFileSync("python3", [
        "-c",
        [
          "import sys, zipfile",
          "zip_path = sys.argv[1]",
          "with zipfile.ZipFile(zip_path, 'w') as archive:",
          "    archive.writestr('../escape.txt', 'pwned')",
        ].join("\n"),
        zipPath,
      ]);

      await expect(extractZipAndScanWithSyft(zipPath, 1000)).rejects.toMatchObject({
        statusCode: 422,
      });
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
