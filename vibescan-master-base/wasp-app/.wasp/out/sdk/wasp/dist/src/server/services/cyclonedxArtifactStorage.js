import { createHash } from 'node:crypto';
import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
let s3Client = null;
function envFlag(value, defaultValue = false) {
    if (value == null)
        return defaultValue;
    const normalized = value.trim().toLowerCase();
    return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
}
function parsePositiveNumber(value, fallback) {
    if (!value)
        return fallback;
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
function resolveStorageConfig() {
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
function getS3Client(config) {
    if (s3Client) {
        return s3Client;
    }
    s3Client = new S3Client({
        region: config.region,
        endpoint: config.endpoint,
        forcePathStyle: config.forcePathStyle,
        credentials: config.accessKeyId && config.secretAccessKey
            ? {
                accessKeyId: config.accessKeyId,
                secretAccessKey: config.secretAccessKey,
            }
            : undefined,
    });
    return s3Client;
}
function stableClone(value) {
    if (Array.isArray(value)) {
        return value.map(stableClone);
    }
    if (value && typeof value === 'object') {
        const entries = Object.entries(value).sort(([a], [b]) => a.localeCompare(b));
        return Object.fromEntries(entries.map(([key, nested]) => [key, stableClone(nested)]));
    }
    return value;
}
export function serializeArtifactPayload(payload) {
    return JSON.stringify(stableClone(payload));
}
export function buildArtifactRetentionTimestamp(capturedAt, retentionDays) {
    return new Date(capturedAt.getTime() + retentionDays * 24 * 60 * 60 * 1000);
}
export function buildCycloneDxArtifactKey(options) {
    const timestampToken = options.capturedAt.toISOString().replace(/[:.]/g, '-');
    const hashSlice = options.sha256.slice(0, 16);
    return `${options.prefix}/${options.scanId}/${options.scannerId}/${timestampToken}-${options.artifactType}-${hashSlice}.json`;
}
export async function captureCycloneDxArtifacts(options) {
    const config = resolveStorageConfig();
    const warnings = [];
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
    const storedArtifacts = [];
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
            await client.send(new PutObjectCommand({
                Bucket: config.bucket,
                Key: artifactKey,
                Body: body,
                ContentType: 'application/json',
            }));
            storedArtifacts.push({
                artifactKey,
                sha256,
                sizeBytes: Buffer.byteLength(body),
                capturedAt: capturedAt.toISOString(),
                retentionUntil: retentionUntil.toISOString(),
            });
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            warnings.push(`artifact_upload_failed:${artifact.artifactType}:${message}`);
        }
    }
    return {
        artifacts: storedArtifacts,
        warnings,
    };
}
export async function cleanupExpiredCycloneDxArtifacts(options) {
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
    const keptArtifacts = [];
    const removedArtifacts = [];
    const warnings = [];
    for (const artifact of options.artifacts) {
        const expiresAt = new Date(artifact.retentionUntil);
        const isExpired = Number.isFinite(expiresAt.getTime()) && expiresAt <= now;
        if (!isExpired) {
            keptArtifacts.push(artifact);
            continue;
        }
        try {
            await client.send(new DeleteObjectCommand({
                Bucket: config.bucket,
                Key: artifact.artifactKey,
            }));
            removedArtifacts.push(artifact);
        }
        catch (error) {
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
export function resetCycloneDxArtifactStorageForTests() {
    s3Client = null;
}
//# sourceMappingURL=cyclonedxArtifactStorage.js.map