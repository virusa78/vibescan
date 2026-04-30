import { afterEach, describe, expect, it } from '@jest/globals';
import {
  buildArtifactRetentionTimestamp,
  buildCycloneDxArtifactKey,
  captureCycloneDxArtifacts,
  cleanupExpiredCycloneDxArtifacts,
  resetCycloneDxArtifactStorageForTests,
  serializeArtifactPayload,
} from '../../wasp-app/src/server/services/cyclonedxArtifactStorage';

const trackedEnv = [
  'VIBESCAN_CYCLONEDX_ARTIFACT_CAPTURE_ENABLED',
  'VIBESCAN_CYCLONEDX_ARTIFACT_CLEANUP_ENABLED',
  'VIBESCAN_CYCLONEDX_ARTIFACT_BUCKET',
  'VIBESCAN_CYCLONEDX_ARTIFACT_PREFIX',
  'VIBESCAN_CYCLONEDX_ARTIFACT_RETENTION_DAYS',
  'AWS_S3_FILES_BUCKET',
];

afterEach(() => {
  for (const key of trackedEnv) {
    delete process.env[key];
  }
  resetCycloneDxArtifactStorageForTests();
});

describe('cyclonedxArtifactStorage', () => {
  it('serializes payload deterministically', () => {
    const a = { z: 1, nested: { b: 2, a: 1 }, arr: [{ k: 2, j: 1 }] };
    const b = { arr: [{ j: 1, k: 2 }], nested: { a: 1, b: 2 }, z: 1 };

    expect(serializeArtifactPayload(a)).toBe(serializeArtifactPayload(b));
  });

  it('builds artifact key and retention timestamp deterministically', () => {
    const capturedAt = new Date('2026-04-23T00:00:00.000Z');
    const retention = buildArtifactRetentionTimestamp(capturedAt, 7);
    expect(retention.toISOString()).toBe('2026-04-30T00:00:00.000Z');

    const key = buildCycloneDxArtifactKey({
      scanId: 'scan-1',
      scannerId: 'free',
      artifactType: 'input_sbom',
      prefix: 'cyclonedx-artifacts',
      capturedAt,
      sha256: 'abcdef1234567890abcdef1234567890',
    });
    expect(key).toContain('cyclonedx-artifacts/scan-1/free/');
    expect(key).toContain('input_sbom');
  });

  it('skips capture when disabled', async () => {
    process.env.VIBESCAN_CYCLONEDX_ARTIFACT_CAPTURE_ENABLED = 'false';

    const result = await captureCycloneDxArtifacts({
      scanId: 'scan-disabled',
      scannerId: 'free',
      artifacts: [{ artifactType: 'input_sbom', payload: { bomFormat: 'CycloneDX' } }],
    });

    expect(result.artifacts).toEqual([]);
    expect(result.warnings).toEqual([]);
  });

  it('returns warning when capture enabled but bucket missing', async () => {
    process.env.VIBESCAN_CYCLONEDX_ARTIFACT_CAPTURE_ENABLED = 'true';

    const result = await captureCycloneDxArtifacts({
      scanId: 'scan-no-bucket',
      scannerId: 'free',
      artifacts: [{ artifactType: 'scanner_result_normalized', payload: { findings: [] } }],
    });

    expect(result.artifacts).toEqual([]);
    expect(result.warnings).toContain('artifact_capture_skipped:missing_bucket');
  });

  it('cleanup keeps artifacts when cleanup is disabled', async () => {
    process.env.VIBESCAN_CYCLONEDX_ARTIFACT_CAPTURE_ENABLED = 'true';
    process.env.VIBESCAN_CYCLONEDX_ARTIFACT_CLEANUP_ENABLED = 'false';

    const artifacts = [
      {
        artifactKey: 'cyclonedx-artifacts/scan/free/a.json',
        sha256: 'abc',
        sizeBytes: 123,
        capturedAt: '2026-04-01T00:00:00.000Z',
        retentionUntil: '2026-04-02T00:00:00.000Z',
      },
    ];

    const result = await cleanupExpiredCycloneDxArtifacts({
      artifacts,
      now: new Date('2026-04-23T00:00:00.000Z'),
    });

    expect(result.keptArtifacts).toEqual(artifacts);
    expect(result.removedArtifacts).toEqual([]);
  });
});
