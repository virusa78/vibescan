import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockS3Send = jest.fn() as any;

jest.mock('@aws-sdk/client-s3', () => {
  return {
    S3Client: jest.fn().mockImplementation((config: any) => {
      return {
        config,
        send: mockS3Send,
      };
    }),
    PutObjectCommand: class PutObjectCommand {
      constructor(public input: any) {}
    },
    DeleteObjectCommand: class DeleteObjectCommand {
      constructor(public input: any) {}
    },
  };
});

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
  'AWS_S3_REGION',
  'AWS_S3_ENDPOINT',
  'AWS_S3_FORCE_PATH_STYLE',
  'AWS_S3_IAM_ACCESS_KEY',
  'AWS_S3_IAM_SECRET_KEY',
];

describe('cyclonedxArtifactStorage', () => {
  beforeEach(() => {
    mockS3Send.mockReset();
    resetCycloneDxArtifactStorageForTests();
    for (const key of trackedEnv) {
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of trackedEnv) {
      delete process.env[key];
    }
    resetCycloneDxArtifactStorageForTests();
  });

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

  describe('envFlag helper coverage', () => {
    it('resolves various boolean flag strings correctly', async () => {
      // Test different truthy values
      const truthyVals = ['1', 'true', 'yes', 'on', '  TRUE  '];
      for (const val of truthyVals) {
        process.env.VIBESCAN_CYCLONEDX_ARTIFACT_CAPTURE_ENABLED = val;
        resetCycloneDxArtifactStorageForTests();
        const result = await captureCycloneDxArtifacts({
          scanId: 'test',
          scannerId: 'free',
          artifacts: [],
        });
        // If it got past the disabled check, warnings/artifacts list is returned (not empty list representing disabled)
        expect(result.warnings).toEqual(['artifact_capture_skipped:missing_bucket']);
      }

      // Test falsy values
      const falsyVals = ['0', 'false', 'no', 'off', 'anything-else'];
      for (const val of falsyVals) {
        process.env.VIBESCAN_CYCLONEDX_ARTIFACT_CAPTURE_ENABLED = val;
        resetCycloneDxArtifactStorageForTests();
        const result = await captureCycloneDxArtifacts({
          scanId: 'test',
          scannerId: 'free',
          artifacts: [{ artifactType: 'input_sbom', payload: {} }],
        });
        expect(result.artifacts).toEqual([]);
        expect(result.warnings).toEqual([]);
      }
    });
  });

  describe('parsePositiveNumber helper coverage', () => {
    it('falls back to default when input is invalid or negative', async () => {
      process.env.VIBESCAN_CYCLONEDX_ARTIFACT_CAPTURE_ENABLED = 'true';
      process.env.VIBESCAN_CYCLONEDX_ARTIFACT_BUCKET = 'test-bucket';

      const invalidVals = ['abc', '-10', '0', ''];
      for (const val of invalidVals) {
        process.env.VIBESCAN_CYCLONEDX_ARTIFACT_RETENTION_DAYS = val;
        resetCycloneDxArtifactStorageForTests();
        mockS3Send.mockResolvedValueOnce({});

        const now = new Date('2026-05-25T12:00:00Z');
        const result = await captureCycloneDxArtifacts({
          scanId: 'test',
          scannerId: 'free',
          artifacts: [{ artifactType: 'input_sbom', payload: {} }],
          now,
        });

        expect(result.artifacts.length).toBe(1);
        // Default retention is 14 days
        const expectedRetention = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
        expect(result.artifacts[0].retentionUntil).toBe(expectedRetention.toISOString());
      }
    });

    it('uses the configured number when positive and valid', async () => {
      process.env.VIBESCAN_CYCLONEDX_ARTIFACT_CAPTURE_ENABLED = 'true';
      process.env.VIBESCAN_CYCLONEDX_ARTIFACT_BUCKET = 'test-bucket';
      process.env.VIBESCAN_CYCLONEDX_ARTIFACT_RETENTION_DAYS = '30';
      resetCycloneDxArtifactStorageForTests();
      mockS3Send.mockResolvedValueOnce({});

      const now = new Date('2026-05-25T12:00:00Z');
      const result = await captureCycloneDxArtifacts({
        scanId: 'test',
        scannerId: 'free',
        artifacts: [{ artifactType: 'input_sbom', payload: {} }],
        now,
      });

      expect(result.artifacts.length).toBe(1);
      const expectedRetention = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      expect(result.artifacts[0].retentionUntil).toBe(expectedRetention.toISOString());
    });
  });

  describe('S3Client configuration options', () => {
    it('sets credentials and endpoint configs correctly', async () => {
      process.env.VIBESCAN_CYCLONEDX_ARTIFACT_CAPTURE_ENABLED = 'true';
      process.env.VIBESCAN_CYCLONEDX_ARTIFACT_BUCKET = 'test-bucket';
      process.env.AWS_S3_REGION = 'us-west-2';
      process.env.AWS_S3_ENDPOINT = 'http://localhost:4566';
      process.env.AWS_S3_FORCE_PATH_STYLE = 'false';
      process.env.AWS_S3_IAM_ACCESS_KEY = 'test-access-key';
      process.env.AWS_S3_IAM_SECRET_KEY = 'test-secret-key';
      resetCycloneDxArtifactStorageForTests();

      mockS3Send.mockResolvedValueOnce({});

      const result = await captureCycloneDxArtifacts({
        scanId: 'test',
        scannerId: 'free',
        artifacts: [{ artifactType: 'input_sbom', payload: {} }],
      });

      expect(result.artifacts.length).toBe(1);
      const { S3Client } = require('@aws-sdk/client-s3');
      expect(S3Client).toHaveBeenCalledWith(
        expect.objectContaining({
          region: 'us-west-2',
          endpoint: 'http://localhost:4566',
          forcePathStyle: false,
          credentials: {
            accessKeyId: 'test-access-key',
            secretAccessKey: 'test-secret-key',
          },
        })
      );
    });
  });

  describe('captureCycloneDxArtifacts S3 operations', () => {
    it('successfully uploads multiple artifacts', async () => {
      process.env.VIBESCAN_CYCLONEDX_ARTIFACT_CAPTURE_ENABLED = 'true';
      process.env.VIBESCAN_CYCLONEDX_ARTIFACT_BUCKET = 'test-bucket';
      resetCycloneDxArtifactStorageForTests();

      mockS3Send.mockResolvedValue({});

      const result = await captureCycloneDxArtifacts({
        scanId: 'scan-ok',
        scannerId: 'free',
        artifacts: [
          { artifactType: 'input_sbom', payload: { a: 1 } },
          { artifactType: 'scanner_result_normalized', payload: { b: 2 } },
        ],
      });

      expect(result.artifacts.length).toBe(2);
      expect(result.warnings).toEqual([]);
      expect(mockS3Send).toHaveBeenCalledTimes(2);
    });

    it('captures upload failures and continues', async () => {
      process.env.VIBESCAN_CYCLONEDX_ARTIFACT_CAPTURE_ENABLED = 'true';
      process.env.VIBESCAN_CYCLONEDX_ARTIFACT_BUCKET = 'test-bucket';
      resetCycloneDxArtifactStorageForTests();

      mockS3Send.mockRejectedValueOnce(new Error('S3 error')).mockResolvedValueOnce({});

      const result = await captureCycloneDxArtifacts({
        scanId: 'scan-fail',
        scannerId: 'free',
        artifacts: [
          { artifactType: 'input_sbom', payload: { a: 1 } },
          { artifactType: 'scanner_result_normalized', payload: { b: 2 } },
        ],
      });

      expect(result.artifacts.length).toBe(1);
      expect(result.warnings.length).toBe(1);
      expect(result.warnings[0]).toContain('artifact_upload_failed:input_sbom:S3 error');
      expect(mockS3Send).toHaveBeenCalledTimes(2);
    });
  });

  describe('cleanupExpiredCycloneDxArtifacts S3 operations', () => {
    it('skips cleanup when bucket is missing and logs warning', async () => {
      process.env.VIBESCAN_CYCLONEDX_ARTIFACT_CAPTURE_ENABLED = 'true';
      process.env.VIBESCAN_CYCLONEDX_ARTIFACT_CLEANUP_ENABLED = 'true';
      // bucket is missing
      resetCycloneDxArtifactStorageForTests();

      const artifacts = [
        {
          artifactKey: 'key',
          sha256: 'sha',
          sizeBytes: 100,
          capturedAt: '2026-05-25T12:00:00Z',
          retentionUntil: '2026-05-25T12:00:00Z',
        },
      ];

      const result = await cleanupExpiredCycloneDxArtifacts({
        artifacts,
        now: new Date('2026-05-25T13:00:00Z'),
      });

      expect(result.keptArtifacts).toEqual(artifacts);
      expect(result.removedArtifacts).toEqual([]);
      expect(result.warnings).toContain('artifact_cleanup_skipped:missing_bucket');
    });

    it('successfully deletes expired artifacts and keeps others', async () => {
      process.env.VIBESCAN_CYCLONEDX_ARTIFACT_CAPTURE_ENABLED = 'true';
      process.env.VIBESCAN_CYCLONEDX_ARTIFACT_CLEANUP_ENABLED = 'true';
      process.env.VIBESCAN_CYCLONEDX_ARTIFACT_BUCKET = 'test-bucket';
      resetCycloneDxArtifactStorageForTests();

      mockS3Send.mockResolvedValue({});

      const expiredArtifact = {
        artifactKey: 'expired-key',
        sha256: 'sha-expired',
        sizeBytes: 100,
        capturedAt: '2026-05-20T12:00:00Z',
        retentionUntil: '2026-05-24T12:00:00Z',
      };
      const activeArtifact = {
        artifactKey: 'active-key',
        sha256: 'sha-active',
        sizeBytes: 100,
        capturedAt: '2026-05-20T12:00:00Z',
        retentionUntil: '2026-05-30T12:00:00Z',
      };

      const result = await cleanupExpiredCycloneDxArtifacts({
        artifacts: [expiredArtifact, activeArtifact],
        now: new Date('2026-05-25T12:00:00Z'),
      });

      expect(result.keptArtifacts).toEqual([activeArtifact]);
      expect(result.removedArtifacts).toEqual([expiredArtifact]);
      expect(result.warnings).toEqual([]);
      expect(mockS3Send).toHaveBeenCalledTimes(1);
    });

    it('handles delete failure by keeping the artifact and recording warning', async () => {
      process.env.VIBESCAN_CYCLONEDX_ARTIFACT_CAPTURE_ENABLED = 'true';
      process.env.VIBESCAN_CYCLONEDX_ARTIFACT_CLEANUP_ENABLED = 'true';
      process.env.VIBESCAN_CYCLONEDX_ARTIFACT_BUCKET = 'test-bucket';
      resetCycloneDxArtifactStorageForTests();

      mockS3Send.mockRejectedValue(new Error('Delete error'));

      const expiredArtifact = {
        artifactKey: 'expired-key',
        sha256: 'sha-expired',
        sizeBytes: 100,
        capturedAt: '2026-05-20T12:00:00Z',
        retentionUntil: '2026-05-24T12:00:00Z',
      };

      const result = await cleanupExpiredCycloneDxArtifacts({
        artifacts: [expiredArtifact],
        now: new Date('2026-05-25T12:00:00Z'),
      });

      expect(result.keptArtifacts).toEqual([expiredArtifact]);
      expect(result.removedArtifacts).toEqual([]);
      expect(result.warnings.length).toBe(1);
      expect(result.warnings[0]).toContain('artifact_delete_failed:expired-key:Delete error');
    });
  });
});
