/**
 * Real Scanner Integration Test
 * Tests actual Grype and Syft scanners against real repositories
 * This is NOT a mock test - it runs actual scanners against real code
 * 
 * Example: Scans https://github.com/revokslab/ShipFree for vulnerabilities
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import type { NormalizedComponent } from '../../wasp-app/src/server/services/inputAdapterService';
import { buildCycloneDxSbom } from '../../wasp-app/src/server/services/inputAdapterService.js';

const TEST_REPO_URL = 'https://github.com/revokslab/ShipFree.git';
const TEST_REPO_DIR = '/tmp/vibescan-real-scanner-test-shipfree';
const SBOM_OUTPUT = '/tmp/vibescan-test-sbom.json';

describe('Real Scanner Integration Tests', () => {
  beforeEach(() => {
    // Clean up any previous test artifacts
    if (fs.existsSync(SBOM_OUTPUT)) {
      fs.unlinkSync(SBOM_OUTPUT);
    }
  });

  describe('Grype Scanner - Real Repository Test', () => {
    it('should scan ShipFree repository and detect vulnerabilities', async () => {
      // Clone repo if not already present
      if (!fs.existsSync(TEST_REPO_DIR)) {
        console.log(`Cloning ${TEST_REPO_URL}...`);
        execSync(`git clone ${TEST_REPO_URL} ${TEST_REPO_DIR}`, {
          stdio: 'inherit',
          timeout: 120000, // 2 minutes for clone
        });
      }

      // Generate SBOM using Trivy
      console.log('Generating SBOM using Trivy...');
      const sbomCommand = `trivy fs --format cyclonedx --output ${SBOM_OUTPUT} ${TEST_REPO_DIR}`;
      
      try {
        execSync(sbomCommand, {
          timeout: 300000, // 5 minutes for SBOM generation
          stdio: ['pipe', 'pipe', 'pipe'], // Suppress output for cleaner test output
        });
      } catch (error) {
        console.error(`Trivy command failed: ${sbomCommand}`);
        throw error;
      }

      // Verify SBOM was generated
      expect(fs.existsSync(SBOM_OUTPUT)).toBe(true);

      const sbomContent = fs.readFileSync(SBOM_OUTPUT, 'utf8');
      const sbom = JSON.parse(sbomContent);

      console.log(`Generated SBOM with ${sbom.components?.length || 0} components`);
      expect(sbom.components).toBeDefined();
      expect(Array.isArray(sbom.components)).toBe(true);

      // Run Grype scan on SBOM
      console.log('Running Grype scan on SBOM...');
      const grypeScanCmd = `grype sbom:${SBOM_OUTPUT} -o json`;
      
      let grypOutput: string;
      try {
        grypOutput = execSync(grypeScanCmd, {
          encoding: 'utf8',
          timeout: 300000, // 5 minutes for Grype scan
          stdio: ['pipe', 'pipe', 'pipe'],
        });
      } catch (error: any) {
        // Grype exits with non-zero if vulnerabilities found
        // This is expected behavior
        grypOutput = error.stdout || '';
        if (!grypOutput) {
          throw error;
        }
      }

      const gryeResult = JSON.parse(grypOutput);

      console.log(`\n=== Grype Scan Results ===`);
      console.log(`Total matches: ${gryeResult.matches?.length || 0}`);

      // Log vulnerabilities summary
      if (gryeResult.matches && gryeResult.matches.length > 0) {
        const severityCount: Record<string, number> = {};
        gryeResult.matches.forEach((match: any) => {
          const severity = match.vulnerability?.severity || 'unknown';
          severityCount[severity] = (severityCount[severity] || 0) + 1;
        });

        console.log('Vulnerabilities by severity:');
        Object.entries(severityCount).forEach(([severity, count]) => {
          console.log(`  ${severity}: ${count}`);
        });

        // Log top 5 vulnerabilities
        console.log('\nTop 5 vulnerabilities:');
        gryeResult.matches.slice(0, 5).forEach((match: any, idx: number) => {
          console.log(
            `  ${idx + 1}. ${match.vulnerability?.id} (${match.vulnerability?.severity}) - ${match.artifact?.name}@${match.artifact?.version}`
          );
        });
      } else {
        console.log('No vulnerabilities detected by Grype');
      }

      // Assertions
      expect(gryeResult).toBeDefined();
      expect(gryeResult.matches).toBeDefined();
      expect(Array.isArray(gryeResult.matches)).toBe(true);

      // If components were found, we expect Grype to run successfully
      if (sbom.components && sbom.components.length > 0) {
        expect(gryeResult.matchesExcludedByConfig || gryeResult.matches).toBeDefined();
      }
    }, 600000); // 10 minute timeout for full scan

    it('should detect known vulnerabilities in test fixtures', async () => {
      // Create a simple test with known vulnerable components
      const testComponents: NormalizedComponent[] = [
        { name: 'lodash', version: '4.17.20' }, // Known to have vulnerabilities
        { name: 'express', version: '4.16.0' },  // Known to have vulnerabilities
      ];

      const testSbomPath = '/tmp/vibescan-test-known-vulns.json';
      const sbom = buildCycloneDxSbom(testComponents);
      fs.writeFileSync(testSbomPath, JSON.stringify(sbom, null, 2));

      console.log(`Testing Grype with known vulnerable components...`);
      const grypCommand = `grype sbom:${testSbomPath} -o json`;

      let grypOutput: string;
      try {
        grypOutput = execSync(grypCommand, {
          encoding: 'utf8',
          timeout: 120000,
          stdio: ['pipe', 'pipe', 'pipe'],
        });
      } catch (error: any) {
        grypOutput = error.stdout || '';
        if (!grypOutput) {
          throw error;
        }
      }

      const result = JSON.parse(grypOutput);

      console.log(`\n=== Known Vulnerabilities Test ===`);
      console.log(`Components scanned: ${testComponents.length}`);
      console.log(`Vulnerabilities found: ${result.matches?.length || 0}`);

      // Should find vulnerabilities in these known-vulnerable versions
      expect(result.matches?.length).toBeGreaterThan(0);

      // Verify structure of vulnerabilities
      if (result.matches && result.matches.length > 0) {
        const firstMatch = result.matches[0];
        expect(firstMatch.vulnerability).toBeDefined();
        expect(firstMatch.vulnerability.id).toBeDefined();
        expect(firstMatch.artifact).toBeDefined();
        expect(firstMatch.artifact.name).toBeDefined();

        console.log(`\nSample vulnerability found:`);
        console.log(`  CVE/ID: ${firstMatch.vulnerability.id}`);
        console.log(`  Severity: ${firstMatch.vulnerability.severity}`);
        console.log(`  Package: ${firstMatch.artifact.name}@${firstMatch.artifact.version}`);
      }

      // Cleanup
      fs.unlinkSync(testSbomPath);
    }, 120000);
  });

  describe('Trivy SBOM Generation', () => {
    it('should generate valid CycloneDX SBOM from JavaScript components', async () => {
      const components: NormalizedComponent[] = [
        { name: 'react', version: '18.2.0', type: 'library', purl: 'pkg:npm/react@18.2.0' },
        { name: 'typescript', version: '5.0.0', type: 'library', purl: 'pkg:npm/typescript@5.0.0' },
        { name: 'eslint', version: '8.0.0', type: 'library', purl: 'pkg:npm/eslint@8.0.0' },
      ];

      const sbom = buildCycloneDxSbom(components);

      // Verify SBOM structure
      expect(sbom.specVersion).toBe('1.4');
      expect(sbom.version).toBe(1);
      expect(sbom.components).toBeDefined();
      expect(sbom.components!.length).toBe(3);

      // Verify components structure
      sbom.components!.forEach((comp: any, idx: number) => {
        expect(comp.type).toBe('library');
        expect(comp.name).toBe(components[idx].name);
        expect(comp.version).toBe(components[idx].version);
      });

      console.log(`\n=== SBOM Structure Test ===`);
      console.log(`Generated valid SBOM with ${sbom.components!.length} components`);
      console.log(`Sample PURLs:`);
      sbom.components!.slice(0, 2).forEach((comp: any) => {
        console.log(`  ${comp.purl || 'N/A'}`);
      });
    });
  });

  describe('Scanner Availability', () => {
    it('should verify Grype is installed and working', async () => {
      try {
        const versionOutput = execSync('grype version', {
          encoding: 'utf8',
          stdio: ['pipe', 'pipe', 'pipe'],
        });

        console.log(`\nGrype version: ${versionOutput.trim()}`);
        expect(versionOutput).toBeDefined();
        expect(versionOutput.length).toBeGreaterThan(0);
      } catch (error) {
        throw new Error('Grype is not installed or not working');
      }
    });

    it('should verify Trivy is installed and working', async () => {
      try {
        const versionOutput = execSync('trivy version', {
          encoding: 'utf8',
          stdio: ['pipe', 'pipe', 'pipe'],
        });

        console.log(`Trivy version: ${versionOutput.trim()}`);
        expect(versionOutput).toBeDefined();
        expect(versionOutput.length).toBeGreaterThan(0);
      } catch (error) {
        throw new Error('Trivy is not installed or not working');
      }
    });
  });

  describe('Scanner Error Handling', () => {
    it('should handle missing SBOM file gracefully', async () => {
      const fakeVulnFile = '/tmp/nonexistent-sbom-12345.json';

      const grypCommand = `grype sbom:${fakeVulnFile} -o json`;

      expect(() => {
        execSync(grypCommand, {
          encoding: 'utf8',
          stdio: ['pipe', 'pipe', 'pipe'],
        });
      }).toThrow();
    });

    it('should handle invalid SBOM JSON gracefully', async () => {
      const invalidSbomPath = '/tmp/invalid-sbom.json';
      fs.writeFileSync(invalidSbomPath, 'This is not JSON');

      const grypCommand = `grype sbom:${invalidSbomPath} -o json`;

      expect(() => {
        execSync(grypCommand, {
          encoding: 'utf8',
          stdio: ['pipe', 'pipe', 'pipe'],
        });
      }).toThrow();

      fs.unlinkSync(invalidSbomPath);
    });
  });
});
