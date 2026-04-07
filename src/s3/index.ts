/**
 * S3 module exports
 *
 * Provides unified access to S3 functionality.
 */

export {
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
} from './client.js';
