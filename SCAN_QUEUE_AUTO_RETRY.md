# Scan Queue Auto-Retry Implementation

## Problem
When the backend goes down during a scan execution, the job remains stuck in the queue without any automatic recovery mechanism. This can result in:
- Scans appearing frozen in the UI
- Jobs never completing or failing gracefully
- No way to distinguish between transient failures and permanent issues
- Loss of visibility into why a job failed

## Solution
Implemented automatic retry logic with exponential backoff, database state tracking, and dead-letter queue handling.

## Architecture

### Retry Configuration (retryPolicy.ts)
- **Max Attempts**: 3 (configured in `SCAN_JOB_RETRY_CONFIG`)
- **Backoff Strategy**: Exponential with 2000ms base delay
  - Attempt 1: Immediate (fails)
  - Attempt 2: After 2 seconds
  - Attempt 3: After 4 seconds
  - Total max wait: 6 seconds across all retries

### Retry Mechanism

#### 1. Job Submission (enqueuePlannedExecution.ts)
```typescript
const job = await queue.add(`scan-${scanId}-${provider}`, jobData, {
  priority: getPriorityForTarget(queueTarget),
  attempts: SCAN_JOB_RETRY_CONFIG.maxAttempts,  // 3
  backoff: {
    type: 'exponential',
    delay: 2000,  // milliseconds
  },
  removeOnComplete: true,   // Successful jobs deleted from queue
  removeOnFail: false,      // Failed jobs retained for inspection
});
```

#### 2. Job Execution (scannerExecutionWorker.ts)
```typescript
try {
  return await executeScannerForScan({...});
} catch (error) {
  const attemptNumber = (job.attemptsMade ?? 0) + 1;
  
  // Track retry in database
  await handleJobFailure(
    loggerLabel,
    scanId,
    job.id,
    attemptNumber,
    SCAN_JOB_RETRY_CONFIG.maxAttempts,
    error
  );
  
  // Re-throw to trigger BullMQ retry
  throw error;
}
```

#### 3. Retry Tracking (Scan Model)
New fields added to track retry history:
- `retryCount` (Int) - Number of retry attempts made
- `lastRetryError` (String?) - Error message from last attempt
- `lastRetryAt` (DateTime?) - Timestamp of last retry

#### 4. Dead-Letter Queue Handling (config.ts)
When a job exhausts all retry attempts (3 failed attempts):
- Job moved to failed jobs list in Redis
- Dead-letter queue event logged with full context
- Manual intervention message logged for ops team

### Logging Output

**Retry Attempt (logged at WARN level):**
```
[Free Scanner / Grype] Scan 12345abc (Job 5) failed attempt 2/3: Connection timeout - retrying in 2000ms
```

**Dead-Letter Event (logged at ERROR level):**
```
[Dead Letter Queue] Scan 12345abc moved to dead-letter after 3 attempts. Manual recovery may be required.
```

## Failure Scenarios Handled

### 1. Backend Service Crash During Scan
- Job fails with error
- BullMQ automatically retries after delay
- Database updated with retry count and error message
- If all retries exhausted: moved to dead-letter queue

### 2. Network Timeout
- Scanner process can't reach external service
- Error thrown, triggering retry
- Exponential backoff ensures spacing between attempts
- Frontend continues polling for status

### 3. Scanner Process Timeout
- Grype/OWASP/Syft takes too long (exceeds timeout)
- Process killed, error caught
- Job retried with fresh process
- Prevents zombie processes from blocking queue

### 4. Database Connection Loss
- Prisma connection error thrown
- Retry mechanism allows reconnection
- Exponential backoff reduces connection storm

## Configuration Options

To adjust retry behavior, modify `src/server/utils/retryPolicy.ts`:

```typescript
export const SCAN_JOB_RETRY_CONFIG = {
  maxAttempts: 3,              // Increase to 5 for slower environments
  delayMs: 2000,               // Base delay before first retry
  backoffType: 'exponential',  // Or 'fixed' for constant delays
} as const;
```

Then rebuild and redeploy.

## Monitoring

### Check Failed Jobs
```bash
# List all failed jobs in free queue
redis-cli -h localhost -p 6379
> KEYS "*free_scan*failed*"
> HGETALL vibescan:free_scan_queue:failed
```

### Check Scan Retry Status
```sql
SELECT id, status, retryCount, lastRetryError, lastRetryAt 
FROM scans 
WHERE retryCount > 0 
ORDER BY lastRetryAt DESC 
LIMIT 10;
```

### Monitor Worker Health
```typescript
import { getWorkerStatus } from '@src/server/queues/config.js';

const status = getWorkerStatus();
// {
//   free: { isRunning: true, isPaused: false },
//   enterprise: { isRunning: true, isPaused: false },
//   webhook: { isRunning: true, isPaused: false }
// }
```

## Frontend Impact

### UI Behavior During Retries
1. Scan shows "Running" status
2. Progress bar may step back if first attempt partially completed
3. User sees same estimated time remaining (no degradation)
4. If max retries exhausted: scan marked as "Failed"

### API Response
The `getScanById` operation returns:
```typescript
{
  scan: { id, status, ... },
  retry_info: {
    attempt_count: 2,
    last_error: "Connection timeout",
    last_retry_at: "2026-05-04T14:02:15Z"
  }
}
```

## Testing Retry Logic

### Simulate Backend Crash
```bash
# Stop backend server
kill <backend-pid>

# Submit a new scan (will queue job)
# Restart backend
# Job should automatically retry after 2 seconds
```

### Verify Exponential Backoff
```bash
# Check logs
tail -f /var/log/vibescan/backend.log | grep "Retry Policy"

# Expected: warnings at 0s, 2s, 4s (3 attempts)
```

### Check Dead-Letter Queue
```bash
# After 3 failed attempts
redis-cli -h localhost -p 6379
> LRANGE vibescan:free_scan_queue:failed 0 -1
# Should show Job IDs of exhausted jobs
```

## Future Enhancements

1. **Webhook Notification**: Notify users when scan exceeds 2 retry attempts
2. **Adaptive Backoff**: Increase delay based on error type (network vs scanner)
3. **Circuit Breaker**: Pause queue if backend unhealthy for >30s
4. **Priority Requeue**: Retry enterprise scans more aggressively than free tier
5. **Manual Recovery**: Admin UI to manually retry dead-lettered jobs

## References

- BullMQ Retry Docs: https://docs.bullmq.io/guide/retries
- Dead-Letter Queue Pattern: https://en.wikipedia.org/wiki/Dead_letter_queue
- Exponential Backoff: https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/
