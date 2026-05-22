import { createHash } from 'node:crypto';
import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

export type CycloneDxArtifactType = 'input_sbom' | 'scanner_result_normalized';

export interface CycloneDxArtifactDescriptor {
  artifactType: CycloneDxArtifactType;
  payload: unknown;
}

export interface CycloneDxArtifactMeta {
  artifactKey: string;
  sha256: string;
  sizeBytes: number;
  capturedAt: string;
  retentionUntil: string;
}

export interface CycloneDxArtifactCaptureResult {
  artifacts: CycloneDxArtifactMeta[];
  warnings: string[];
}

export interface CycloneDxArtifactCleanupResult {
  keptArtifacts: CycloneDxArtifactMeta[];
  removedArtifacts: CycloneDxArtifactMeta[];
  warnings: string[];
}

interface ArtifactStorageConfig {
  enabled: boolean;
  cleanupEnabled: boolean;
  bucket: string | null;
  prefix: string;
  retentionDays: number;
  region: string;
  endpoint?: string;
  forcePathStyle: boolean;
  accessKeyId?: string;
  secretAccessKey?: string;
}

let s3Client: S3Client | null = null;

function envFlag(value: string | undefined, defaultValue = false): boolean {
  if (value == null) return defaultValue;
  const normalized = value.trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
}

function parsePositiveNumber(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function resolveStorageConfig(): ArtifactStorageConfig {
  const bucket = process.env.VIBESCAN_CYCLONEDX_ARTIFACT_BUCKET || process.env.AWS_S3_FILES_BUCKET || null;

  return {
    enabled: envFlag(process.env.VIBESCAN_CYCLONEDX_ARTIFACT_CAPTURE_ENABLED, true),
    cleanupEnabled: envFlag(process.env.VIBESCAN_CYCLONEDX_ARTIFACT_CLEANUP_ENABLED, true),
    bucket,
    prefix: process.env.VIBESCAN_CYCLONEDX_ARTIFACT_PREFIX || 'cyclonedx-artifacts',
    retentionDays: parsePositiveNumber(process.env.VIBESCAN_CYCLONEDX_ARTIFACT_RETENTION_DAYS, 14),
    region: process.env.AWS_S3_REGION || 'us-east-1',
    endpoint: process.env.AWS_S3_ENDPOINT || undefined,
    forcePathStyle: envFlag(process.env.AWS_S3_FORCE_PATH_STYLE, true),
    accessKeyId: process.env.AWS_S3_IAM_ACCESS_KEY || undefined,
    secretAccessKey: process.env.AWS_S3_IAM_SECRET_KEY || undefined,
  };
}

function getS3Client(config: ArtifactStorageConfig): S3Client {
  if (s3Client) {
    return s3Client;
  }

  s3Client = new S3Client({
    region: config.region,
    endpoint: config.endpoint,
    forcePathStyle: config.forcePathStyle,
    credentials:
      config.accessKeyId && config.secretAccessKey
        ? {
            accessKeyId: config.accessKeyId,
            secretAccessKey: config.secretAccessKey,
          }
        : undefined,
  });

  return s3Client;
}

function stableClone(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(stableClone);
  }
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b));
    return Object.fromEntries(entries.map(([key, nested]) => [key, stableClone(nested)]));
  }
  return value;
}

export function serializeArtifactPayload(payload: unknown): string {
  return JSON.stringify(stableClone(payload));
}

export function buildArtifactRetentionTimestamp(capturedAt: Date, retentionDays: number): Date {
  return new Date(capturedAt.getTime() + retentionDays * 24 * 60 * 60 * 1000);
}

export function buildCycloneDxArtifactKey(options: {
  scanId: string;
  scannerId: string;
  artifactType: CycloneDxArtifactType;
  prefix: string;
  capturedAt: Date;
  sha256: string;
}): string {
  const timestampToken = options.capturedAt.toISOString().replace(/[:.]/g, '-');
  const hashSlice = options.sha256.slice(0, 16);
  return `${options.prefix}/${options.scanId}/${options.scannerId}/${timestampToken}-${options.artifactType}-${hashSlice}.json`;
}

export async function captureCycloneDxArtifacts(options: {
  scanId: string;
  scannerId: string;
  artifacts: CycloneDxArtifactDescriptor[];
  now?: Date;
}): Promise<CycloneDxArtifactCaptureResult> {
  const config = resolveStorageConfig();
  const warnings: string[] = [];

  if (!config.enabled) {
    return { artifacts: [], warnings };
  }

  if (!config.bucket) {
    return {
      artifacts: [],
      warnings: ['artifact_capture_skipped:missing_bucket'],
    };
  }

  const capturedAt = options.now || new Date();
  const retentionUntil = buildArtifactRetentionTimestamp(capturedAt, config.retentionDays);
  const client = getS3Client(config);
  const storedArtifacts: CycloneDxArtifactMeta[] = [];

  for (const artifact of options.artifacts) {
    const body = serializeArtifactPayload(artifact.payload);
    const sha256 = createHash('sha256').update(body).digest('hex');
    const artifactKey = buildCycloneDxArtifactKey({
      scanId: options.scanId,
      scannerId: options.scannerId,
      artifactType: artifact.artifactType,
      prefix: config.prefix,
      capturedAt,
      sha256,
    });

    try {
      await client.send(
        new PutObjectCommand({
          Bucket: config.bucket,
          Key: artifactKey,
          Body: body,
          ContentType: 'application/json',
        }),
      );

      storedArtifacts.push({
        artifactKey,
        sha256,
        sizeBytes: Buffer.byteLength(body),
        capturedAt: capturedAt.toISOString(),
        retentionUntil: retentionUntil.toISOString(),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      warnings.push(`artifact_upload_failed:${artifact.artifactType}:${message}`);
    }
  }

  return {
    artifacts: storedArtifacts,
    warnings,
  };
}

export async function cleanupExpiredCycloneDxArtifacts(options: {
  artifacts: CycloneDxArtifactMeta[];
  now?: Date;
}): Promise<CycloneDxArtifactCleanupResult> {
  const config = resolveStorageConfig();
  const now = options.now || new Date();

  if (!config.cleanupEnabled || !config.enabled) {
    return {
      keptArtifacts: options.artifacts,
      removedArtifacts: [],
      warnings: [],
    };
  }

  if (!config.bucket) {
    return {
      keptArtifacts: options.artifacts,
      removedArtifacts: [],
      warnings: ['artifact_cleanup_skipped:missing_bucket'],
    };
  }

  const client = getS3Client(config);
  const keptArtifacts: CycloneDxArtifactMeta[] = [];
  const removedArtifacts: CycloneDxArtifactMeta[] = [];
  const warnings: string[] = [];

  for (const artifact of options.artifacts) {
    const expiresAt = new Date(artifact.retentionUntil);
    const isExpired = Number.isFinite(expiresAt.getTime()) && expiresAt <= now;

    if (!isExpired) {
      keptArtifacts.push(artifact);
      continue;
    }

    try {
      await client.send(
        new DeleteObjectCommand({
          Bucket: config.bucket,
          Key: artifact.artifactKey,
        }),
      );
      removedArtifacts.push(artifact);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      warnings.push(`artifact_delete_failed:${artifact.artifactKey}:${message}`);
      keptArtifacts.push(artifact);
    }
  }

  return {
    keptArtifacts,
    removedArtifacts,
    warnings,
  };
}

export function resetCycloneDxArtifactStorageForTests(): void {
  s3Client = null;
}
