/**
 * E2E Test: Grype Scanner Execution
 * Validates that Grype can scan a real component and return findings
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFileSync, unlinkSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const execAsync = promisify(exec);

async function testGrypeScan() {
  console.log('🧪 E2E Test: Grype Scanner Execution\n');

  // Create a test SBOM with a known vulnerable package
  const testSbom = {
    bomFormat: 'CycloneDX',
    specVersion: '1.4',
    version: 1,
    components: [
      {
        type: 'library',
        name: 'log4j-core',
        version: '2.14.0',
      },
    ],
  };

  const sbomPath = join('/home/virus/vibescan', 'test-sbom.json');

  try {
    // Write test SBOM
    writeFileSync(sbomPath, JSON.stringify(testSbom, null, 2));
    console.log(`✓ Created test SBOM at ${sbomPath}`);

    // Execute Grype
    console.log('\n📊 Running Grype scan...');
    const { stdout, stderr } = await execAsync(
      `grype sbom:${sbomPath} -o json`,
      { timeout: 60000 }
    );

    const grypOutput = JSON.parse(stdout);
    console.log(`✓ Grype execution succeeded`);

    // Analyze results
    const matchCount = grypOutput.matches?.length || 0;
    console.log(`\n📈 Results:`);
    console.log(`  - Vulnerabilities found: ${matchCount}`);

    if (matchCount > 0) {
      console.log(`  - Sample finding:`);
      const match = grypOutput.matches[0];
      console.log(`    - CVE: ${match.vulnerability?.id}`);
      console.log(`    - Severity: ${match.vulnerability?.severity}`);
      console.log(`    - Package: ${match.artifact?.name} v${match.artifact?.version}`);
      console.log(`    - CVSS Score: ${match.vulnerability?.cvssScore?.baseScore}`);
    }

    console.log(`\n✅ Grype E2E test PASSED`);
    return true;
  } catch (error) {
    console.error(`\n❌ Grype E2E test FAILED:`);
    console.error(error instanceof Error ? error.message : String(error));
    return false;
  } finally {
    // Cleanup
    if (existsSync(sbomPath)) {
      unlinkSync(sbomPath);
      console.log(`\n🧹 Cleaned up test SBOM`);
    }
  }
}

// Run test
testGrypeScan()
  .then(success => process.exit(success ? 0 : 1))
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
