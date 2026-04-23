import { afterEach, describe, expect, it } from '@jest/globals';
import {
  decideComponentsWithCycloneDx,
  ingestScannerFindingsWithCycloneDx,
  resolveCycloneDxPipelineMode,
} from '../../wasp-app/src/server/services/cyclonedxIngestionService';

const trackedEnv = [
  'VIBESCAN_CYCLONEDX_SHADOW_ENABLED',
  'VIBESCAN_CYCLONEDX_CUTOVER_ENABLED',
  'VIBESCAN_CYCLONEDX_ROLLBACK_ENABLED',
];

function resetEnv() {
  for (const key of trackedEnv) {
    delete process.env[key];
  }
}

afterEach(() => {
  resetEnv();
});

describe('cyclonedxIngestionService', () => {
  it('uses legacy mode by default', () => {
    expect(resolveCycloneDxPipelineMode()).toBe('legacy');
  });

  it('returns shadow mode when enabled', () => {
    process.env.VIBESCAN_CYCLONEDX_SHADOW_ENABLED = 'true';
    expect(resolveCycloneDxPipelineMode()).toBe('shadow');
  });

  it('prefers rollback over cutover', () => {
    process.env.VIBESCAN_CYCLONEDX_CUTOVER_ENABLED = 'true';
    process.env.VIBESCAN_CYCLONEDX_ROLLBACK_ENABLED = 'true';
    expect(resolveCycloneDxPipelineMode()).toBe('rollback');
  });

  it('keeps legacy components in shadow mode and exposes drift telemetry', () => {
    process.env.VIBESCAN_CYCLONEDX_SHADOW_ENABLED = 'true';

    const decision = decideComponentsWithCycloneDx({
      scanId: 'scan-shadow-1',
      scannerId: 'free',
      legacyComponents: [
        { name: 'axios', version: '1.4.0', purl: 'pkg:npm/axios@1.4.0', type: 'library' },
      ],
      sbomRaw: {
        bomFormat: 'CycloneDX',
        specVersion: '1.4',
        version: 1,
        components: [
          { name: 'axios', version: '1.4.0', purl: 'pkg:npm/axios@1.4.0', type: 'library' },
        ],
      },
    });

    expect(decision.mode).toBe('shadow');
    expect(decision.selectedComponents).toHaveLength(1);
    expect(decision.telemetry.status).toBe('ingested');
    expect(decision.telemetry.drift).toEqual({
      legacyComponents: 1,
      unifiedComponents: 1,
      missingInUnified: 0,
      extraInUnified: 0,
    });
  });

  it('uses unified components in cutover mode', () => {
    process.env.VIBESCAN_CYCLONEDX_CUTOVER_ENABLED = 'true';

    const decision = decideComponentsWithCycloneDx({
      scanId: 'scan-cutover-1',
      scannerId: 'free',
      legacyComponents: [
        { name: 'axios', version: '1.4.0', purl: 'pkg:npm/axios@1.4.0', type: 'library' },
      ],
      sbomRaw: {
        bomFormat: 'CycloneDX',
        specVersion: '1.4',
        version: 1,
        components: [
          { name: 'lodash', version: '4.17.21', purl: 'pkg:npm/lodash@4.17.21', type: 'library' },
        ],
      },
    });

    expect(decision.mode).toBe('cutover');
    expect(decision.selectedComponents).toEqual([
      { name: 'lodash', version: '4.17.21', purl: 'pkg:npm/lodash@4.17.21', type: 'library' },
    ]);
    expect(decision.telemetry.status).toBe('ingested');
  });

  it('builds unified vulnerability stats from scanner findings', () => {
    process.env.VIBESCAN_CYCLONEDX_SHADOW_ENABLED = 'true';

    const result = ingestScannerFindingsWithCycloneDx({
      scanId: 'scan-findings-1',
      scannerId: 'enterprise',
      components: [
        { name: 'lodash', version: '4.17.21', purl: 'pkg:npm/lodash@4.17.21', type: 'library' },
      ],
      findings: [
        {
          cveId: 'CVE-2026-1234',
          severity: 'high',
          package: 'lodash',
          version: '4.17.21',
          cvssScore: 7.5,
          description: 'Test vuln',
          fixedVersion: '4.17.22',
        },
      ],
    });

    expect(result.ingestionResult.status).toBe('ingested');
    expect(result.telemetry.status).toBe('ingested');
    expect(result.telemetry.unifiedStats).toEqual({
      components: 1,
      vulnerabilities: 1,
      severity: { high: 1 },
    });
  });
});
