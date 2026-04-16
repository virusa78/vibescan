/**
 * S3 client configuration
 *
 * Provides S3 client with bucket management and TTL policies.
 */

import { S3Client, CreateBucketCommand, PutBucketLifecycleConfigurationCommand, GetBucketLifecycleConfigurationCommand, DeleteObjectsCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand, ListObjectsV2Command, PutObjectCommand, CreateMultipartUploadCommand, UploadPartCommand, CompleteMultipartUploadCommand, HeadBucketCommand } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import dotenv from 'dotenv';

dotenv.config();

// S3 configuration
const s3Config = {
    region: process.env.AWS_REGION || 'us-east-1',
    endpoint: process.env.S3_ENDPOINT || undefined,
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || ''
    }
};

// S3 client instance
let s3Client: S3Client | null = null;

/**
 * Get or create S3 client instance
 */
export async function getS3Client(): Promise<S3Client> {
    if (s3Client) {
        return s3Client;
    }

    s3Client = new S3Client(s3Config);
    return s3Client;
}

/**
 * Close S3 client connection
 */
export async function closeS3Connection(): Promise<void> {
    if (s3Client) {
        s3Client.destroy();
        s3Client = null;
    }
}

// Bucket names
export const BUCKET_SOURCES = process.env.S3_BUCKET_SOURCES || 'vibescan-sources';
export const BUCKET_SBOMS = process.env.S3_BUCKET_SBOMS || 'vibescan-sboms';
export const BUCKET_PDFS = process.env.S3_BUCKET_PDFS || 'vibescan-pdfs';

/**
 * Create buckets if they don't exist
 */
export async function ensureBucketsExist(): Promise<void> {
    const s3 = await getS3Client();

    const buckets = [BUCKET_SOURCES, BUCKET_SBOMS, BUCKET_PDFS];

    for (const bucket of buckets) {
        try {
            await s3.send(new CreateBucketCommand({ Bucket: bucket }));
            console.log(`S3: Created bucket: ${bucket}`);
        } catch (error: any) {
            if (error.name === 'BucketAlreadyOwnedByYou' ||
                error.name === 'BucketAlreadyExists' ||
                error.Code === 'BucketAlreadyOwnedByYou' ||
                error.Code === 'BucketAlreadyExists' ||
                error.message?.includes('Bucket already exists')) {
                console.log(`S3: Bucket already exists: ${bucket}`);
            } else {
                // Check if bucket actually exists by listing it
                try {
                    await s3.send(new HeadBucketCommand({ Bucket: bucket }));
                    console.log(`S3: Bucket already exists: ${bucket}`);
                } catch (headError: any) {
                    if (headError.Code === '404' || headError.name === 'NotFound') {
                        throw error; // Bucket doesn't exist, throw original error
                    }
                    console.log(`S3: Bucket already exists: ${bucket}`);
                }
            }
        }
    }
}

/**
 * Set up lifecycle policies for buckets
 */
export async function setupLifecyclePolicies(): Promise<void> {
    const s3 = await getS3Client();

    // Source archives: 24 hours TTL
    const sourceLifecycle: any = {
        Rules: [
            {
                ID: 'DeleteSourceArchivesAfter24Hours',
                Filter: { Prefix: '' },
                Status: 'Enabled',
                Expiration: { Days: 1 }
            }
        ]
    };

    // SBOM documents: 90 days TTL
    const sbomLifecycle: any = {
        Rules: [
            {
                ID: 'DeleteSBOMsAfter90Days',
                Filter: { Prefix: '' },
                Status: 'Enabled',
                Expiration: { Days: 90 }
            }
        ]
    };

    // PDF reports: 30 days TTL
    const pdfLifecycle: any = {
        Rules: [
            {
                ID: 'DeletePDFsAfter30Days',
                Filter: { Prefix: '' },
                Status: 'Enabled',
                Expiration: { Days: 30 }
            }
        ]
    };

    await s3.send(new PutBucketLifecycleConfigurationCommand({
        Bucket: BUCKET_SOURCES,
        LifecycleConfiguration: sourceLifecycle
    }));

    await s3.send(new PutBucketLifecycleConfigurationCommand({
        Bucket: BUCKET_SBOMS,
        LifecycleConfiguration: sbomLifecycle
    }));

    await s3.send(new PutBucketLifecycleConfigurationCommand({
        Bucket: BUCKET_PDFS,
        LifecycleConfiguration: pdfLifecycle
    }));

    console.log('S3: Lifecycle policies configured');
}

/**
 * Upload a file to S3
 * @param bucket - Bucket name
 * @param key - Object key
 * @param body - File content
 * @param contentType - Content type
 * @returns ETag of uploaded object
 */
export async function uploadFile(
    bucket: string,
    key: string,
    body: Buffer | string,
    contentType?: string
): Promise<string> {
    const s3 = await getS3Client();

    const upload = new Upload({
        client: s3,
        params: {
            Bucket: bucket,
            Key: key,
            Body: body,
            ContentType: contentType
        }
    });

    const result = await upload.done();
    return result.ETag || '';
}

/**
 * Download a file from S3
 * @param bucket - Bucket name
 * @param key - Object key
 * @returns File content as Buffer
 */
export async function downloadFile(
    bucket: string,
    key: string
): Promise<Buffer> {
    const s3 = await getS3Client();

    const result = await s3.send(new GetObjectCommand({
        Bucket: bucket,
        Key: key
    }));

    const chunks: Buffer[] = [];
    for await (const chunk of result.Body as any) {
        chunks.push(chunk);
    }

    return Buffer.concat(chunks);
}

/**
 * Delete a file from S3
 * @param bucket - Bucket name
 * @param key - Object key
 */
export async function deleteFile(
    bucket: string,
    key: string
): Promise<void> {
    const s3 = await getS3Client();

    await s3.send(new DeleteObjectCommand({
        Bucket: bucket,
        Key: key
    }));
}

/**
 * Delete multiple files from S3
 * @param bucket - Bucket name
 * @param keys - Array of object keys
 */
export async function deleteFiles(
    bucket: string,
    keys: string[]
): Promise<void> {
    if (keys.length === 0) return;

    const s3 = await getS3Client();

    const chunks: string[][] = [];
    for (let i = 0; i < keys.length; i += 1000) {
        chunks.push(keys.slice(i, i + 1000));
    }

    for (const chunk of chunks) {
        await s3.send(new DeleteObjectsCommand({
            Bucket: bucket,
            Delete: {
                Objects: chunk.map(key => ({ Key: key })),
                Quiet: true
            }
        }));
    }
}

/**
 * Generate a presigned URL for file access
 * @param bucket - Bucket name
 * @param key - Object key
 * @param expiresIn - URL expiration time in seconds
 * @returns Presigned URL
 */
export async function generatePresignedUrl(
    bucket: string,
    key: string,
    expiresIn: number = 3600
): Promise<string> {
    const s3 = await getS3Client();
    const command = new GetObjectCommand({ Bucket: bucket, Key: key });

    return await getSignedUrl(s3, command, { expiresIn });
}

/**
 * Check if a file exists in S3
 * @param bucket - Bucket name
 * @param key - Object key
 * @returns true if file exists
 */
export async function fileExists(
    bucket: string,
    key: string
): Promise<boolean> {
    const s3 = await getS3Client();

    try {
        await s3.send(new HeadObjectCommand({
            Bucket: bucket,
            Key: key
        }));
        return true;
    } catch (error: any) {
        if (error.name === 'NotFound' || error.name === 'NoSuchKey') {
            return false;
        }
        throw error;
    }
}

/**
 * List files in a bucket with optional prefix
 * @param bucket - Bucket name
 * @param prefix - Optional prefix filter
 * @param maxKeys - Maximum number of keys to return
 * @returns Array of object keys
 */
export async function listFiles(
    bucket: string,
    prefix?: string,
    maxKeys: number = 1000
): Promise<string[]> {
    const s3 = await getS3Client();

    const keys: string[] = [];
    let continuationToken: string | undefined;

    do {
        const result = await s3.send(new ListObjectsV2Command({
            Bucket: bucket,
            Prefix: prefix,
            MaxKeys: maxKeys,
            ContinuationToken: continuationToken
        }));

        if (result.Contents) {
            for (const obj of result.Contents) {
                if (obj.Key) {
                    keys.push(obj.Key);
                }
            }
        }

        continuationToken = result.NextContinuationToken;
    } while (continuationToken);

    return keys;
}

export default {
    getS3Client,
    closeS3Connection,
    ensureBucketsExist,
    setupLifecyclePolicies,
    uploadFile,
    downloadFile,
    deleteFile,
    deleteFiles,
    generatePresignedUrl,
    fileExists,
    listFiles,
    BUCKET_SOURCES,
    BUCKET_SBOMS,
    BUCKET_PDFS
};
