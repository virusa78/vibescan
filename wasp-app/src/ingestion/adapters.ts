/**
 * PR-05: Scanner Adapters
 * 
 * Convert scanner-specific output formats to CycloneDX JSON.
 * Each scanner has different field names and structures.
 * Adapters normalize these to our canonical CycloneDX format.
 */

import type { RawCycloneDXDocument } from "./cyclonedx-contracts";

export interface ScannerAdapter {
  scannerName: string;
  adapt(
    rawOutput: string | Record<string, any>,
    metadata?: AdapterMetadata
  ): AdapterResult;
}

export interface AdapterMetadata {
  scannerVersion?: string;
  timestamp?: string;
  environment?: Record<string, string>;
  [key: string]: any;
}

export type AdapterResult = 
  | { success: true; document: RawCycloneDXDocument }
  | { success: false; error: string };

// Helper: Create success result
function success(document: RawCycloneDXDocument): AdapterResult {
  return { success: true, document };
}

// Helper: Create error result
function err(error: string): AdapterResult {
  return { success: false, error };
}

// ============================================================================
// Grype Adapter
// ============================================================================

export class GrypeAdapter implements ScannerAdapter {
  scannerName = "grype";

  adapt(
    rawOutput: string | Record<string, any>,
    metadata?: AdapterMetadata
  ): AdapterResult {
    try {
      const grypeJson =
        typeof rawOutput === "string" ? JSON.parse(rawOutput) : rawOutput;

      if (!grypeJson || typeof grypeJson !== "object") {
        return err("Invalid Grype output format");
      }

      const matches = grypeJson.matches || [];
      const components: any[] = [];
      const componentMap = new Map<string, any>();
      const vulnerabilities: any[] = [];

      for (const match of matches) {
        try {
          const vuln = match.vulnerability || {};
          const artifact = match.artifact || {};
          const componentKey = `${artifact.name}@${artifact.version}`;

          if (!componentMap.has(componentKey)) {
            const component = {
              "bom-ref": componentKey,
              type: "library",
              name: artifact.name || "unknown",
              version: artifact.version || "unknown",
              purl: artifact.purl || "",
            };
            componentMap.set(componentKey, component);
            components.push(component);
          }

          const vulnerability: any = {
            ref: componentKey,
            id: vuln.id || `UNKNOWN-${vulnerabilities.length}`,
            source: {
              name: vuln.dataSource || "grype",
              url: vuln.dataSourceUrl || "",
            },
            ratings: [],
            cwe: [],
            references: [],
          };

          if (vuln.severity) {
            const score = this.parseCVSSScore(vuln.cvssScore);
            vulnerability.ratings.push({
              score,
              severity: this.normalizeSeverity(vuln.severity),
            });
          }

          if (vuln.cweIds && Array.isArray(vuln.cweIds)) {
            vulnerability.cwe = vuln.cweIds.map((cwe: string) => ({
              id: cwe.startsWith("CWE-") ? cwe : `CWE-${cwe}`,
            }));
          }

          if (vuln.fix?.versions) {
            vulnerability.fixes = [{ versions: vuln.fix.versions }];
          }

          if (vuln.url) {
            vulnerability.references.push({ url: vuln.url });
          }

          vulnerabilities.push(vulnerability);
        } catch (e) {
          // Skip malformed
        }
      }

      return success({
        bomFormat: "CycloneDX",
        specVersion: "1.5",
        serialNumber: `urn:uuid:${this.generateUUID()}`,
        version: 1,
        metadata: {
          timestamp: metadata?.timestamp || new Date().toISOString(),
          tools: [
            {
              name: "grype",
              version: metadata?.scannerVersion || "unknown",
            },
          ],
        },
        components,
        vulnerabilities,
      });
    } catch (e) {
      return err(e instanceof Error ? e.message : String(e));
    }
  }

  private normalizeSeverity(s: string): string {
    const map: Record<string, string> = {
      critical: "critical",
      high: "high",
      medium: "medium",
      low: "low",
      negligible: "info",
    };
    return map[s.toLowerCase()] || "unknown";
  }

  private parseCVSSScore(score: any): number | undefined {
    if (score === null || score === undefined) return undefined;
    const parsed = Number(score);
    return isNaN(parsed) || parsed < 0 || parsed > 10 ? undefined : parsed;
  }

  private generateUUID(): string {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }
}

// ============================================================================
// Trivy Adapter
// ============================================================================

export class TrivyAdapter implements ScannerAdapter {
  scannerName = "trivy";

  adapt(
    rawOutput: string | Record<string, any>,
    metadata?: AdapterMetadata
  ): AdapterResult {
    try {
      const trivyJson =
        typeof rawOutput === "string" ? JSON.parse(rawOutput) : rawOutput;

      if (!trivyJson || typeof trivyJson !== "object") {
        return err("Invalid Trivy output format");
      }

      const results = trivyJson.Results || [];
      const components: any[] = [];
      const componentMap = new Map<string, any>();
      const vulnerabilities: any[] = [];

      for (const result of results) {
        const vulns = result.Vulnerabilities || [];

        for (const vuln of vulns) {
          try {
            const componentKey = `${vuln.PkgName}@${vuln.PkgVersion}`;

            if (!componentMap.has(componentKey)) {
              const component = {
                "bom-ref": componentKey,
                type: "library",
                name: vuln.PkgName || "unknown",
                version: vuln.PkgVersion || "unknown",
              };
              componentMap.set(componentKey, component);
              components.push(component);
            }

            const vulnerability: any = {
              ref: componentKey,
              id: vuln.VulnerabilityID || `UNKNOWN-${vulnerabilities.length}`,
              source: {
                name: vuln.VulnerabilitySource || "trivy",
                url: vuln.PrimaryURL || "",
              },
              ratings: [],
              cwe: [],
              references: [],
            };

            if (vuln.Severity) {
              const score = this.parseCVSSScore(vuln.CVSS?.nvd?.V3Score);
              vulnerability.ratings.push({
                score,
                severity: this.normalizeSeverity(vuln.Severity),
              });
            }

            if (vuln.CweIDs && Array.isArray(vuln.CweIDs)) {
              vulnerability.cwe = vuln.CweIDs.map((cwe: string) => ({
                id: cwe.startsWith("CWE-") ? cwe : `CWE-${cwe}`,
              }));
            }

            if (vuln.FixedVersion) {
              vulnerability.fixes = [{ version: vuln.FixedVersion }];
            }

            if (vuln.PrimaryURL) {
              vulnerability.references.push({ url: vuln.PrimaryURL });
            }

            vulnerabilities.push(vulnerability);
          } catch (e) {
            // Skip malformed
          }
        }
      }

      return success({
        bomFormat: "CycloneDX",
        specVersion: "1.5",
        serialNumber: `urn:uuid:${this.generateUUID()}`,
        version: 1,
        metadata: {
          timestamp: metadata?.timestamp || new Date().toISOString(),
          tools: [
            {
              name: "trivy",
              version: metadata?.scannerVersion || "unknown",
            },
          ],
        },
        components,
        vulnerabilities,
      });
    } catch (e) {
      return err(e instanceof Error ? e.message : String(e));
    }
  }

  private normalizeSeverity(s: string): string {
    const map: Record<string, string> = {
      CRITICAL: "critical",
      HIGH: "high",
      MEDIUM: "medium",
      LOW: "low",
      NEGLIGIBLE: "info",
      UNKNOWN: "unknown",
    };
    return map[s.toUpperCase()] || "unknown";
  }

  private parseCVSSScore(score: any): number | undefined {
    if (score === null || score === undefined) return undefined;
    const parsed = Number(score);
    return isNaN(parsed) || parsed < 0 || parsed > 10 ? undefined : parsed;
  }

  private generateUUID(): string {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }
}

// ============================================================================
// Snyk Adapter
// ============================================================================

export class SnykAdapter implements ScannerAdapter {
  scannerName = "snyk";

  adapt(
    rawOutput: string | Record<string, any>,
    metadata?: AdapterMetadata
  ): AdapterResult {
    try {
      const snykJson =
        typeof rawOutput === "string" ? JSON.parse(rawOutput) : rawOutput;

      if (!snykJson || typeof snykJson !== "object") {
        return err("Invalid Snyk output format");
      }

      const vulns = snykJson.vulnerabilities || [];
      const components: any[] = [];
      const componentMap = new Map<string, any>();
      const vulnerabilities: any[] = [];

      for (const vuln of vulns) {
        try {
          const componentKey = `${vuln.package}@${vuln.version}`;

          if (!componentMap.has(componentKey)) {
            const component = {
              "bom-ref": componentKey,
              type: "library",
              name: vuln.package || "unknown",
              version: vuln.version || "unknown",
            };
            componentMap.set(componentKey, component);
            components.push(component);
          }

          const vulnerability: any = {
            ref: componentKey,
            id: vuln.name || vuln.id || `UNKNOWN-${vulnerabilities.length}`,
            source: {
              name: "snyk",
              url: vuln.url || "",
            },
            ratings: [],
            cwe: [],
            references: [],
          };

          if (vuln.severity) {
            const score = this.parseCVSSScore(vuln.cvssScore);
            vulnerability.ratings.push({
              score,
              severity: this.normalizeSeverity(vuln.severity),
            });
          }

          if (vuln.fixedVersion) {
            vulnerability.fixes = [{ version: vuln.fixedVersion }];
          }

          if (vuln.url) {
            vulnerability.references.push({ url: vuln.url });
          }

          vulnerabilities.push(vulnerability);
        } catch (e) {
          // Skip malformed
        }
      }

      return success({
        bomFormat: "CycloneDX",
        specVersion: "1.5",
        serialNumber: `urn:uuid:${this.generateUUID()}`,
        version: 1,
        metadata: {
          timestamp: metadata?.timestamp || new Date().toISOString(),
          tools: [
            {
              name: "snyk",
              version: metadata?.scannerVersion || "unknown",
            },
          ],
        },
        components,
        vulnerabilities,
      });
    } catch (e) {
      return err(e instanceof Error ? e.message : String(e));
    }
  }

  private normalizeSeverity(s: string): string {
    const map: Record<string, string> = {
      critical: "critical",
      high: "high",
      medium: "medium",
      low: "low",
    };
    return map[s.toLowerCase()] || "unknown";
  }

  private parseCVSSScore(score: any): number | undefined {
    if (score === null || score === undefined) return undefined;
    const parsed = Number(score);
    return isNaN(parsed) || parsed < 0 || parsed > 10 ? undefined : parsed;
  }

  private generateUUID(): string {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }
}

// ============================================================================
// OSV Adapter
// ============================================================================

export class OSVAdapter implements ScannerAdapter {
  scannerName = "osv-scanner";

  adapt(
    rawOutput: string | Record<string, any>,
    metadata?: AdapterMetadata
  ): AdapterResult {
    try {
      const osvJson =
        typeof rawOutput === "string" ? JSON.parse(rawOutput) : rawOutput;

      if (!osvJson || typeof osvJson !== "object") {
        return err("Invalid OSV output format");
      }

      const results = osvJson.results || [];
      const components: any[] = [];
      const componentMap = new Map<string, any>();
      const vulnerabilities: any[] = [];

      for (const result of results) {
        const packages = result.packages || [];

        for (const pkg of packages) {
          try {
            const pkgInfo = pkg.package || {};
            const pkgVulns = pkg.vulnerabilities || [];
            const componentKey = `${pkgInfo.name}@${pkgInfo.version}`;

            if (!componentMap.has(componentKey)) {
              const component = {
                "bom-ref": componentKey,
                type: "library",
                name: pkgInfo.name || "unknown",
                version: pkgInfo.version || "unknown",
              };
              componentMap.set(componentKey, component);
              components.push(component);
            }

            for (const vuln of pkgVulns) {
              try {
                const vulnerability: any = {
                  ref: componentKey,
                  id: vuln.id || `UNKNOWN-${vulnerabilities.length}`,
                  source: {
                    name: "osv",
                    url: vuln.links?.webpage || "",
                  },
                  ratings: [],
                  cwe: [],
                  references: [],
                };

                if (vuln.severity?.type === "CVSS_V3") {
                  const score = this.parseCVSSScore(vuln.severity.score);
                  if (score !== undefined) {
                    vulnerability.ratings.push({
                      score,
                      severity: this.cvssToSeverity(score),
                    });
                  }
                }

                if (vuln.links?.webpage) {
                  vulnerability.references.push({ url: vuln.links.webpage });
                }

                vulnerabilities.push(vulnerability);
              } catch (e) {
                // Skip malformed
              }
            }
          } catch (e) {
            // Skip malformed
          }
        }
      }

      return success({
        bomFormat: "CycloneDX",
        specVersion: "1.5",
        serialNumber: `urn:uuid:${this.generateUUID()}`,
        version: 1,
        metadata: {
          timestamp: metadata?.timestamp || new Date().toISOString(),
          tools: [
            {
              name: "osv-scanner",
              version: metadata?.scannerVersion || "unknown",
            },
          ],
        },
        components,
        vulnerabilities,
      });
    } catch (e) {
      return err(e instanceof Error ? e.message : String(e));
    }
  }

  private cvssToSeverity(score: number): string {
    if (score >= 9.0) return "critical";
    if (score >= 7.0) return "high";
    if (score >= 4.0) return "medium";
    if (score >= 0.1) return "low";
    return "info";
  }

  private parseCVSSScore(score: any): number | undefined {
    if (score === null || score === undefined) return undefined;
    const parsed = Number(score);
    return isNaN(parsed) || parsed < 0 || parsed > 10 ? undefined : parsed;
  }

  private generateUUID(): string {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }
}

// ============================================================================
// Registry
// ============================================================================

export class AdapterRegistry {
  private adapters: Map<string, ScannerAdapter> = new Map();

  constructor() {
    this.register(new GrypeAdapter());
    this.register(new TrivyAdapter());
    this.register(new SnykAdapter());
    this.register(new OSVAdapter());
  }

  register(adapter: ScannerAdapter): void {
    this.adapters.set(adapter.scannerName.toLowerCase(), adapter);
  }

  getAdapter(scannerName: string): ScannerAdapter | null {
    return this.adapters.get(scannerName.toLowerCase()) || null;
  }

  listScanners(): string[] {
    return Array.from(this.adapters.keys());
  }

  adapt(
    scannerName: string,
    rawOutput: string | Record<string, any>,
    metadata?: AdapterMetadata
  ): AdapterResult {
    const adapter = this.getAdapter(scannerName);
    if (!adapter) {
      return err(
        `Unknown scanner: ${scannerName} (supported: ${this.listScanners().join(", ")})`
      );
    }
    return adapter.adapt(rawOutput, metadata);
  }
}
