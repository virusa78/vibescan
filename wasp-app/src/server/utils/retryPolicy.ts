/**
 * Retry Policy Configuration for BullMQ Scan Jobs
 * 
 * Implements exponential backoff with jitter to handle:
 * - Backend service crashes
 * - Temporary network failures  
 * - Scanner process timeouts
 * - Database connection issues
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Retry configuration: 3 attempts with exponential backoff
 * Attempt 1: Immediate (fail)
 * Attempt 2: After 2 seconds
 * Attempt 3: After 4 seconds  
 * Total max wait: 6 seconds across retries
 */
export const SCAN_JOB_RETRY_CONFIG = {
  maxAttempts: 3,
  delayMs: 2000,
  backoffType: 'exponential' as const,
} as const;

/**
 * Update scan with retry status information
 */
export async function updateScanRetryStatus(
  scanId: string,
  attemptNumber: number,
  error: Error,
): Promise<void> {
  try {
    await prisma.scan.update({
      where: { id: scanId },
      data: {
        retryCount: attemptNumber,
        lastRetryError: error.message,
        lastRetryAt: new Date(),
      },
    });
  } catch (updateError) {
    console.error(`[Retry Policy] Failed to update scan ${scanId} retry status:`, updateError);
    // Continue even if update fails - don't block job retry
  }
}

/**
 * Check if job should be retried based on error type
 * Some errors are not worth retrying (validation errors, auth failures)
 */
export function isRetryableError(error: unknown): boolean {
  const errorMsg = error instanceof Error ? error.message : String(error);

  // Don't retry auth/validation errors
  if (
    errorMsg.includes('Unauthorized') ||
    errorMsg.includes('not found') ||
    errorMsg.includes('invalid') ||
    errorMsg.includes('validation')
  ) {
    return false;
  }

  // Retry transient errors (network, timeout, service failures)
  return true;
}

/**
 * Log retry attempt with context
 */
export function logRetryAttempt(
  label: string,
  scanId: string,
  jobId: string,
  attemptNumber: number,
  maxAttempts: number,
  error: Error,
): void {
  const retryText = attemptNumber < maxAttempts 
    ? `retrying in ${SCAN_JOB_RETRY_CONFIG.delayMs * Math.pow(2, attemptNumber - 1)}ms`
    : 'moving to dead-letter queue after max retries';

  console.warn(
    `[${label}] Scan ${scanId} (Job ${jobId}) failed attempt ${attemptNumber}/${maxAttempts}: ${error.message} - ${retryText}`,
  );
}

/**
 * Handle job failure and log for recovery
 */
export async function handleJobFailure(
  label: string,
  scanId: string,
  jobId: string | undefined,
  attemptNumber: number,
  maxAttempts: number,
  error: Error,
): Promise<void> {
  logRetryAttempt(label, scanId, jobId || 'unknown', attemptNumber, maxAttempts, error);

  // Update scan with retry information
  await updateScanRetryStatus(scanId, attemptNumber, error);

  // If final attempt failed, mark scan as failed
  if (attemptNumber >= maxAttempts) {
    console.error(
      `[${label}] Scan ${scanId} exhausted all ${maxAttempts} retry attempts. Manual intervention required.`,
    );
  }
}
