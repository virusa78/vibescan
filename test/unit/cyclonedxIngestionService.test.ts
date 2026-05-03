import { afterEach, describe, expect, it } from '@jest/globals';
import {
  evaluateCutoverQualityGate,
  getUnknownFieldCatalogSnapshot,
  resetUnknownFieldCatalogForTests,
  setUnknownFieldTriageStatus,
  decideComponentsWithCycloneDx,
  buildCycloneDxIngestionMeta,
  ingestScannerFindingsWithCycloneDx,
  resolveCycloneDxPipelineMode,
} from '../../wasp-app/src/server/services/cyclonedxIngestionService';

const trackedEnv = [
  'VIBESCAN_CYCLONEDX_SHADOW_ENABLED',
  'VIBESCAN_CYCLONEDX_CUTOVER_ENABLED',
  'VIBESCAN_CYCLONEDX_ROLLBACK_ENABLED',
  'VIBESCAN_CYCLONEDX_DRIFT_RATE_THRESHOLD',
  'VIBESCAN_CYCLONEDX_CANARY_STAGE',
];

function resetEnv() {
  for (const key of trackedEnv) {
    delete process.env[key];
  }
}

afterEach(() => {
  resetEnv();
  resetUnknownFieldCatalogForTests();
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

  it('collects unknown fields in rollback mode without affecting cutover decisions', () => {
    process.env.VIBESCAN_CYCLONEDX_ROLLBACK_ENABLED = 'true';

    const componentDecision = decideComponentsWithCycloneDx({
      scanId: 'scan-rollback-1',
      scannerId: 'free',
      legacyComponents: [{ name: 'axios', version: '1.4.0', purl: 'pkg:npm/axios@1.4.0', type: 'library' }],
      sbomRaw: {
        bomFormat: 'CycloneDX',
        specVersion: '1.4',
        version: 1,
        extraTopLevel: { unsupported: true },
        components: [
          { name: 'axios', version: '1.4.0', purl: 'pkg:npm/axios@1.4.0', type: 'library', customRisk: 'elevated' },
        ],
      },
    });

    const resultDecision = ingestScannerFindingsWithCycloneDx({
      scanId: 'scan-rollback-1',
      scannerId: 'free',
      components: [{ name: 'axios', version: '1.4.0', purl: 'pkg:npm/axios@1.4.0', type: 'library' }],
      findings: [
        {
          cveId: 'CVE-2026-5555',
          severity: 'medium',
          package: 'axios',
          version: '1.4.0',
        },
      ],
    });

    const ingestionMeta = buildCycloneDxIngestionMeta({
      mode: componentDecision.mode,
      scannerId: 'free',
      componentDecision,
      resultDecision,
    });

    expect(componentDecision.mode).toBe('rollback');
    expect(componentDecision.ingestionResult?.status).toBe('ingested');
    expect(ingestionMeta.unknownFieldCatalog.some((entry) => entry.path === '$.extraTopLevel')).toBe(true);
    expect(ingestionMeta.gate.status).toBe('not_applicable');
  });

  it('supports triage workflow from new to accepted and preserves status on re-ingest', () => {
    process.env.VIBESCAN_CYCLONEDX_SHADOW_ENABLED = 'true';

    const componentDecision = decideComponentsWithCycloneDx({
      scanId: 'scan-triage-1',
      scannerId: 'enterprise',
      legacyComponents: [{ name: 'lodash', version: '4.17.21', purl: 'pkg:npm/lodash@4.17.21', type: 'library' }],
      sbomRaw: {
        bomFormat: 'CycloneDX',
        specVersion: '1.6',
        version: 1,
        components: [
          { name: 'lodash', version: '4.17.21', purl: 'pkg:npm/lodash@4.17.21', type: 'library', xRiskTag: 'r1' },
        ],
      },
    });

    const resultDecision = ingestScannerFindingsWithCycloneDx({
      scanId: 'scan-triage-1',
      scannerId: 'enterprise',
      components: [{ name: 'lodash', version: '4.17.21', purl: 'pkg:npm/lodash@4.17.21', type: 'library' }],
      findings: [],
    });

    buildCycloneDxIngestionMeta({
      mode: componentDecision.mode,
      scannerId: 'enterprise',
      componentDecision,
      resultDecision,
    });

    const newEntry = getUnknownFieldCatalogSnapshot().find((entry) => entry.path === '$.components[0].xRiskTag');
    expect(newEntry?.status).toBe('new');

    const triaged = setUnknownFieldTriageStatus({
      scannerId: 'enterprise',
      specVersion: '1.6',
      path: '$.components[0].xRiskTag',
      status: 'accepted',
    });
    expect(triaged.status).toBe('accepted');

    const secondDecision = decideComponentsWithCycloneDx({
      scanId: 'scan-triage-2',
      scannerId: 'enterprise',
      legacyComponents: [{ name: 'lodash', version: '4.17.21', purl: 'pkg:npm/lodash@4.17.21', type: 'library' }],
      sbomRaw: {
        bomFormat: 'CycloneDX',
        specVersion: '1.6',
        version: 1,
        components: [
          { name: 'lodash', version: '4.17.21', purl: 'pkg:npm/lodash@4.17.21', type: 'library', xRiskTag: 'r1' },
        ],
      },
    });
    const secondResult = ingestScannerFindingsWithCycloneDx({
      scanId: 'scan-triage-2',
      scannerId: 'enterprise',
      components: [{ name: 'lodash', version: '4.17.21', purl: 'pkg:npm/lodash@4.17.21', type: 'library' }],
      findings: [],
    });
    buildCycloneDxIngestionMeta({
      mode: secondDecision.mode,
      scannerId: 'enterprise',
      componentDecision: secondDecision,
      resultDecision: secondResult,
    });

    const acceptedEntry = getUnknownFieldCatalogSnapshot().find((entry) => entry.path === '$.components[0].xRiskTag');
    expect(acceptedEntry?.status).toBe('accepted');
    expect((acceptedEntry?.count || 0) >= 2).toBe(true);
  });

  it('blocks cutover gate on validation errors and high drift', () => {
    process.env.VIBESCAN_CYCLONEDX_DRIFT_RATE_THRESHOLD = '0.2';

    const gateFromError = evaluateCutoverQualityGate({
      scannerId: 'free',
      mode: 'cutover',
      result: {
        scanId: 'scan-gate-error',
        status: 'rejected',
        stage: 'validation',
        processingTimeMs: 5,
        error: {
          type: 'validation_error',
          code: 'cyclonedx_validation_failed',
          message: 'bad doc',
          timestamp: new Date(),
        },
      },
    });
    expect(gateFromError.status).toBe('block_cutover');
    expect(gateFromError.blockerErrors).toEqual(['validation_error']);

    const gateFromDrift = evaluateCutoverQualityGate({
      scannerId: 'free',
      mode: 'shadow',
      componentTelemetry: {
        scanId: 'scan-gate-drift',
        scannerId: 'free',
        mode: 'shadow',
        stage: 'components',
        status: 'ingested',
        processingMs: 8,
        drift: {
          legacyComponents: 4,
          unifiedComponents: 4,
          missingInUnified: 1,
          extraInUnified: 1,
        },
      },
      result: {
        scanId: 'scan-gate-drift',
        status: 'ingested',
        processingTimeMs: 8,
        payload: {
          scanId: 'scan-gate-drift',
          scannerId: 'free',
          scanTime: new Date(),
          components: [],
          vulnerabilities: [],
          stats: { componentCount: 0, vulnerabilityCount: 0, severityCounts: {} },
          _originalDocument: {
            bomFormat: 'CycloneDX',
            specVersion: '1.4',
            version: 1,
            components: [],
            vulnerabilities: [],
            _validation: { schemaVersion: '1.4', isValid: true, issues: [], validatedAt: new Date() },
          },
          _unknownFields: new Map(),
        },
      },
    });
    expect(gateFromDrift.status).toBe('block_cutover');
  });

  it('uses strict default drift blocker and returns canary promotion decisions', () => {
    process.env.VIBESCAN_CYCLONEDX_CANARY_STAGE = 'shadow_smoke';

    const allowGate = evaluateCutoverQualityGate({
      scannerId: 'free',
      mode: 'shadow',
      componentTelemetry: {
        scanId: 'scan-canary-allow',
        scannerId: 'free',
        mode: 'shadow',
        stage: 'components',
        status: 'ingested',
        processingMs: 2,
        drift: {
          legacyComponents: 10,
          unifiedComponents: 10,
          missingInUnified: 0,
          extraInUnified: 1,
        },
      },
      result: {
        scanId: 'scan-canary-allow',
        status: 'ingested',
        processingTimeMs: 2,
        payload: {
          scanId: 'scan-canary-allow',
          scannerId: 'free',
          scanTime: new Date(),
          components: [],
          vulnerabilities: [],
          stats: { componentCount: 0, vulnerabilityCount: 0, severityCounts: {} },
          _originalDocument: {
            bomFormat: 'CycloneDX',
            specVersion: '1.4',
            version: 1,
            components: [],
            vulnerabilities: [],
            _validation: { schemaVersion: '1.4', isValid: true, issues: [], validatedAt: new Date() },
          },
          _unknownFields: new Map(),
        },
      },
    });

    expect(allowGate.status).toBe('allow_cutover');
    expect(allowGate.driftThreshold).toBe(0.1);
    expect(allowGate.canaryDecision.status).toBe('allow_promote');
    expect(allowGate.canaryDecision.nextStage).toBe('canary_cutover_cohort');
  });

  it('returns rollback_required canary decision in rollback mode', () => {
    const rollbackGate = evaluateCutoverQualityGate({
      scannerId: 'enterprise',
      mode: 'rollback',
      result: {
        scanId: 'scan-canary-rollback',
        status: 'ingested',
        processingTimeMs: 1,
        payload: {
          scanId: 'scan-canary-rollback',
          scannerId: 'enterprise',
          scanTime: new Date(),
          components: [],
          vulnerabilities: [],
          stats: { componentCount: 0, vulnerabilityCount: 0, severityCounts: {} },
          _originalDocument: {
            bomFormat: 'CycloneDX',
            specVersion: '1.4',
            version: 1,
            components: [],
            vulnerabilities: [],
            _validation: { schemaVersion: '1.4', isValid: true, issues: [], validatedAt: new Date() },
          },
          _unknownFields: new Map(),
        },
      },
    });

    expect(rollbackGate.status).toBe('not_applicable');
    expect(rollbackGate.canaryDecision.status).toBe('rollback_required');
  });

  it('supports ready_for_prod canary stage with cutover mode', () => {
    process.env.VIBESCAN_CYCLONEDX_CANARY_STAGE = 'ready_for_prod';

    const gate = evaluateCutoverQualityGate({
      scannerId: 'enterprise',
      mode: 'cutover',
      componentTelemetry: {
        scanId: 'scan-ready-for-prod',
        scannerId: 'enterprise',
        mode: 'cutover',
        stage: 'components',
        status: 'ingested',
        processingMs: 3,
        drift: {
          legacyComponents: 5,
          unifiedComponents: 5,
          missingInUnified: 0,
          extraInUnified: 0,
        },
      },
      result: {
        scanId: 'scan-ready-for-prod',
        status: 'ingested',
        processingTimeMs: 3,
        payload: {
          scanId: 'scan-ready-for-prod',
          scannerId: 'enterprise',
          scanTime: new Date(),
          components: [],
          vulnerabilities: [],
          stats: { componentCount: 0, vulnerabilityCount: 0, severityCounts: {} },
          _originalDocument: {
            bomFormat: 'CycloneDX',
            specVersion: '1.4',
            version: 1,
            components: [],
            vulnerabilities: [],
            _validation: { schemaVersion: '1.4', isValid: true, issues: [], validatedAt: new Date() },
          },
          _unknownFields: new Map(),
        },
      },
    });

    expect(gate.status).toBe('allow_cutover');
    expect(gate.canaryDecision.status).toBe('allow_promote');
    expect(gate.canaryDecision.stage).toBe('ready_for_prod');
    expect(gate.canaryDecision.nextStage).toBeNull();
  });
});
