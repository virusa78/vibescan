/**
 * Job contract for scanner workers
 */

export interface ScanJob {
  scanId: string;
  userId: string;
  inputType: string; // 'source_zip', 'sbom_upload', 'github_app'
  inputRef: string;
  s3Bucket: string;
}
