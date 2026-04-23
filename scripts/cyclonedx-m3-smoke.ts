import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import {
  evaluateCutoverQualityGate,
  type CycloneDxTelemetry,
} from '../wasp-app/src/server/services/cyclonedxIngestionService.js';
import type { IngestionResult } from '../wasp-app/src/ingestion/cyclonedx-contracts.js';

interface SmokeEvidence {
  generatedAt: string;
  driftBlockerThreshold: number;
  suite: string;
  checks: Array<{
    id: string;
    passed: boolean;
    details: string;
  }>;
  summary: {
    passed: number;
    failed: number;
    promotionReady: boolean;
    blockerErrors: string[];
    rollbackVerified: boolean;
  };
}

function ingestedResult(scanId: string): IngestionResult {
  return {
    scanId,
    status: 'ingested',
    processingTimeMs: 5,
    payload: {
      scanId,
      scannerId: 'free',
      scanTime: new Date(),
      components: [],
      vulnerabilities: [],
      stats: {
        componentCount: 0,
        vulnerabilityCount: 0,
        severityCounts: {},
      },
      _originalDocument: {
        bomFormat: 'CycloneDX',
        specVersion: '1.4',
        version: 1,
        components: [],
        vulnerabilities: [],
        _validation: {
          schemaVersion: '1.4',
          isValid: true,
          issues: [],
          validatedAt: new Date(),
        },
      },
      _unknownFields: new Map(),
    },
  };
}

function rejectedValidationResult(scanId: string): IngestionResult {
  return {
    scanId,
    status: 'rejected',
    stage: 'validation',
    processingTimeMs: 4,
    error: {
      type: 'validation_error',
      code: 'cyclonedx_validation_failed',
      message: 'invalid document',
      timestamp: new Date(),
    },
  };
}

function writeEvidence(evidence: SmokeEvidence): void {
  const jsonPath = resolve('docs/CYCLONEDX_M3_SMOKE_EVIDENCE.json');
  const mdPath = resolve('docs/CYCLONEDX_M3_SMOKE_REPORT.md');

  mkdirSync(dirname(jsonPath), { recursive: true });

  writeFileSync(jsonPath, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');

  const markdown = [
    '# CycloneDX M3 Smoke Report',
    '',
    `Generated at: ${evidence.generatedAt}`,
    `Drift blocker threshold: ${evidence.driftBlockerThreshold.toFixed(2)}`,
    '',
    '## Checks',
    ...evidence.checks.map((check) => `- [${check.passed ? 'x' : ' '}] ${check.id} — ${check.details}`),
    '',
    '## Summary',
    `- Passed: ${evidence.summary.passed}`,
    `- Failed: ${evidence.summary.failed}`,
    `- Promotion ready: ${evidence.summary.promotionReady}`,
    `- Rollback verified: ${evidence.summary.rollbackVerified}`,
    `- Blocker errors: ${evidence.summary.blockerErrors.join(', ') || 'none'}`,
    '',
    `JSON evidence: ${jsonPath}`,
  ].join('\n');

  writeFileSync(mdPath, `${markdown}\n`, 'utf8');
}

function run(): void {
  process.env.VIBESCAN_CYCLONEDX_DRIFT_RATE_THRESHOLD = '0.10';

  const driftTelemetry: CycloneDxTelemetry = {
    scanId: 'smoke-drift',
    scannerId: 'free',
    mode: 'shadow',
    stage: 'components',
    status: 'ingested',
    processingMs: 5,
    drift: {
      legacyComponents: 10,
      unifiedComponents: 10,
      missingInUnified: 1,
      extraInUnified: 1,
    },
  };

  process.env.VIBESCAN_CYCLONEDX_CANARY_STAGE = 'shadow_smoke';
  const allowGate = evaluateCutoverQualityGate({
    scannerId: 'free',
    mode: 'shadow',
    componentTelemetry: {
      ...driftTelemetry,
      drift: {
        legacyComponents: 10,
        unifiedComponents: 10,
        missingInUnified: 0,
        extraInUnified: 1,
      },
    },
    result: ingestedResult('smoke-allow'),
  });

  const blockGate = evaluateCutoverQualityGate({
    scannerId: 'free',
    mode: 'shadow',
    componentTelemetry: driftTelemetry,
    result: ingestedResult('smoke-block-drift'),
  });

  const errorGate = evaluateCutoverQualityGate({
    scannerId: 'enterprise',
    mode: 'cutover',
    result: rejectedValidationResult('smoke-block-error'),
  });

  const rollbackGate = evaluateCutoverQualityGate({
    scannerId: 'free',
    mode: 'rollback',
    result: ingestedResult('smoke-rollback'),
  });

  const checks: SmokeEvidence['checks'] = [
    {
      id: 'gate-allows-promote-at-drift-<=-0.10',
      passed:
        allowGate.status === 'allow_cutover' && allowGate.canaryDecision.status === 'allow_promote' && allowGate.driftRate <= 0.10,
      details: `status=${allowGate.status}, canary=${allowGate.canaryDecision.status}, drift=${allowGate.driftRate.toFixed(4)}`,
    },
    {
      id: 'gate-blocks-promote-at-drift->-0.10',
      passed:
        blockGate.status === 'block_cutover' &&
        blockGate.canaryDecision.status === 'block_promote' &&
        blockGate.reasons.some((reason) => reason.startsWith('drift_rate_exceeded')),
      details: `status=${blockGate.status}, canary=${blockGate.canaryDecision.status}`,
    },
    {
      id: 'gate-blocks-on-validation-error',
      passed:
        errorGate.status === 'block_cutover' &&
        errorGate.blockerErrors.includes('validation_error') &&
        errorGate.canaryDecision.status === 'block_promote',
      details: `status=${errorGate.status}, blockers=${errorGate.blockerErrors.join(',')}`,
    },
    {
      id: 'rollback-forces-rollback-required',
      passed: rollbackGate.status === 'not_applicable' && rollbackGate.canaryDecision.status === 'rollback_required',
      details: `status=${rollbackGate.status}, canary=${rollbackGate.canaryDecision.status}`,
    },
  ];

  const evidence: SmokeEvidence = {
    generatedAt: new Date().toISOString(),
    driftBlockerThreshold: 0.1,
    suite: 'cyclonedx-m3-smoke',
    checks,
    summary: {
      passed: checks.filter((check) => check.passed).length,
      failed: checks.filter((check) => !check.passed).length,
      promotionReady: allowGate.canaryDecision.status === 'allow_promote' && blockGate.canaryDecision.status === 'block_promote',
      blockerErrors: errorGate.blockerErrors,
      rollbackVerified: rollbackGate.canaryDecision.status === 'rollback_required',
    },
  };

  writeEvidence(evidence);

  if (evidence.summary.failed > 0) {
    console.error('[CycloneDXM3Smoke] failed checks:', evidence.summary.failed);
    process.exitCode = 1;
    return;
  }

  console.log('[CycloneDXM3Smoke] passed');
}

run();
