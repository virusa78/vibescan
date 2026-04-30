# Dual-Scanner Orchestration Implementation

## Overview

This document describes the implementation of VibeScan's dual-scanner orchestration system, which coordinates Grype (free) and Codescoring/BlackDuck (enterprise) vulnerability scanners.

## Architecture

### Components

1. **Orchestrator** (`src/server/operations/scans/orchestrator.ts`)
   - Coordinates scan submission
   - Enqueues both free and enterprise scanner jobs
   - Manages scan lifecycle and error handling

2. **Free Scanner Worker** (`src/server/workers/freeScannerWorker.ts`)
   - Runs Grype vulnerability scanner
   - Normalizes findings to shared schema
   - Stores results in PostgreSQL and S3

3. **Enterprise Scanner Worker** (`src/server/workers/enterpriseScannerWorker.ts`)
   - Calls Codescoring/BlackDuck API
   - Normalizes findings to shared schema
   - Stores results in PostgreSQL and S3

4. **Queue Configuration** (`src/server/queues/config.ts`)
   - Sets up BullMQ queues with Redis backend
   - Configures worker concurrency and priorities
   - Manages job lifecycle

5. **Normalization Helper** (`src/server/operations/scans/normalizeFindings.ts`)
   - Parses Grype JSON output
   - Parses Codescoring JSON output
   - Normalizes both to shared Finding interface

## Scan Submission Flow

```
1. User calls submitScan() operation
   ↓
2. Quota check performed (transaction)
   ↓
3. Scan record created in PostgreSQL (status: pending)
   ↓
4. ScanDelta record created (for tracking)
   ↓
5. Transaction commits
   ↓
6. orchestrateScan() called (outside transaction)
   ↓
7. Free scanner job enqueued (priority: 10)
   ↓
8. Enterprise scanner job enqueued if enterprise plan (priority: 100)
   ↓
9. Scan status updated to "queued"
   ↓
10. Response returned with scanId and job IDs
```

## Job Processing Flow

### Free Scanner (Grype)
1. Job dequeued from `free_scan_queue`
2. Scan status → `scanning`
3. Execute Grype via Docker or CLI
4. Parse JSON output
5. Normalize findings
6. Store in `ScanResult` table (source: 'free')
7. Create `Finding` records for each finding
8. Check if enterprise completed
   - If yes: update scan to `done`
   - If no: keep scanning
9. Return completion status

### Enterprise Scanner (Codescoring)
1. Job dequeued from `enterprise_scan_queue`
2. Scan status → `scanning`
3. Call Codescoring API with auth
4. Parse response
5. Normalize findings
6. Store in `ScanResult` table (source: 'enterprise')
7. Create `Finding` records for each finding
8. Check if free completed
   - If yes: update scan to `done`
   - If no: keep scanning
9. Return completion status

## Error Handling

### Partial Completion

If one scanner fails, the scan still completes:

- **Free fails, Enterprise succeeds**: Scan marked `done` with enterprise results
- **Enterprise fails, Free succeeds**: Scan marked `done` with free results
- **Both fail**: Scan marked `error` with error message
- **Both fail but was queued**: Can be retried

### Retry Logic

- Max retries: 3
- Backoff: exponential (2s, 4s, 8s)
- Failed jobs moved to dead letter queue after max retries

## Database Schema

### Scan Table
```sql
CREATE TABLE scans (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  input_type VARCHAR(50),         -- 'source_zip', 'sbom_upload', 'github_app'
  input_ref VARCHAR(500),         -- filename, URL, GitHub ref, etc.
  status VARCHAR(50),             -- pending, queued, scanning, done, error, cancelled
  plan_at_submission VARCHAR(50), -- user's plan at submission time
  error_message TEXT,
  created_at TIMESTAMP,
  completed_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

### ScanResult Table
```sql
CREATE TABLE scan_results (
  id UUID PRIMARY KEY,
  scan_id UUID NOT NULL,
  source VARCHAR(50),             -- 'free' or 'enterprise'
  raw_output JSONB,               -- original scanner output
  vulnerabilities JSONB,          -- normalized findings array
  scanner_version VARCHAR(50),
  cve_db_timestamp TIMESTAMP,
  duration_ms INTEGER,
  created_at TIMESTAMP,
  UNIQUE(scan_id, source)
);
```

### Finding Table
```sql
CREATE TABLE findings (
  id UUID PRIMARY KEY,
  scan_id UUID NOT NULL,
  user_id UUID NOT NULL,
  fingerprint VARCHAR(255),       -- dedup hash: cveId|package|version
  cve_id VARCHAR(50),
  package_name VARCHAR(255),
  installed_version VARCHAR(50),
  severity VARCHAR(50),           -- CRITICAL, HIGH, MEDIUM, LOW, INFO
  cvss_score DECIMAL(3,1),
  fixed_version VARCHAR(50),
  source VARCHAR(50),             -- 'free' or 'enterprise'
  description TEXT,
  detected_data JSONB,
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  UNIQUE(scan_id, fingerprint)
);
```

### ScanDelta Table (for tracking differences)
```sql
CREATE TABLE scan_deltas (
  id UUID PRIMARY KEY,
  scan_id UUID NOT NULL UNIQUE,
  total_free_count INTEGER,
  total_enterprise_count INTEGER,
  delta_count INTEGER,
  delta_by_severity JSONB,
  is_locked BOOLEAN,              -- true for free_trial/starter plans
  created_at TIMESTAMP
);
```

## API Contracts

### Normal Findings Interface
```typescript
interface NormalizedFinding {
  cveId: string;
  severity: "critical" | "high" | "medium" | "low" | "info";
  package: string;
  version: string;
  fixedVersion?: string;
  description: string;
  cvssScore: number;
  source: "free" | "enterprise";
}
```

### Job Contract (Queue)
```typescript
interface ScanJob {
  scanId: string;
  userId: string;
  inputType: string;
  inputRef: string;
  s3Bucket: string;
}
```

### Orchestrator Input
```typescript
interface OrchestratorInput {
  scanId: string;
  userId: string;
  inputType: string;
  inputRef: string;
  planAtSubmission: string;
}
```

## Testing

### Unit Tests (`tests/normalizeFindings.test.ts`)

Tests the finding normalization logic:
- ✓ Grype output normalization
- ✓ Codescoring output normalization
- ✓ Fingerprint computation
- ✓ Edge cases (null, empty, missing fields)

Run with:
```bash
npm test -- normalizeFindings.test.ts
```

### Integration Tests (`tests/orchestration.test.ts`)

Tests the full orchestration flow:
- ✓ Scan orchestration for enterprise users
- ✓ Scan orchestration for free users
- ✓ Error handling and recovery
- ✓ Database state verification

Run with:
```bash
npm test -- orchestration.test.ts
```

## Configuration

### Environment Variables

```bash
# Redis connection
REDIS_HOST=localhost
REDIS_PORT=6379

# Database connection (handled by Wasp)
DATABASE_URL=postgresql://user:password@localhost:5432/vibescan

# AWS S3 (for artifact storage)
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=xxx
AWS_SECRET_ACCESS_KEY=xxx
S3_BUCKET=vibescan-scans

# Codescoring API
CODESCORING_API_KEY=xxx
CODESCORING_API_URL=https://api.codescoring.com

# Grype (if not using Docker)
GRYPE_DB_PATH=/var/lib/grype/db
```

## Queue Status

Monitor queue status:
```typescript
import { getScanQueueStatus } from '@src/server/operations/scans/orchestrator';

const status = await getScanQueueStatus(scanId);
console.log(status);
// {
//   scanId: "scan-123",
//   freeScanner: { jobId: "job-1", state: "active", progress: 50 },
//   enterpriseScanner: { jobId: "job-2", state: "waiting", progress: 0 }
// }
```

## Cancellation

Cancel a pending scan:
```typescript
import { cancelScan } from '@src/server/operations/scans/orchestrator';

await cancelScan(scanId);
```

## Performance Considerations

1. **Parallel Processing**: Both scanners run concurrently
2. **Concurrency Limits**: 
   - Free: 20 concurrent (lightweight)
   - Enterprise: 3 concurrent (resource-intensive)
3. **Timeouts**: 30 minutes per job (configurable)
4. **Retries**: Automatic retry on failure with backoff
5. **Deduplication**: Fingerprint-based finding dedup across scans

## Security Considerations

1. **Isolation**: Scanners run in Docker containers with restricted permissions
2. **API Keys**: Securely stored in environment variables
3. **SQL Injection**: Protected via Prisma ORM
4. **Rate Limiting**: Applied to queue processing
5. **Ownership Checks**: All operations verify user ownership

## Troubleshooting

### Scans stuck in "queued" state
- Check Redis connectivity
- Verify workers are running
- Check `initializeWorkers()` was called

### Findings not appearing
- Check scanner output format matches expected schema
- Verify database connections
- Check S3 bucket permissions

### High job failure rate
- Check retry count and backoff settings
- Verify environment variables set correctly
- Check worker logs for specific errors

## Future Enhancements

1. **Parallel Finding Processing**: Process findings in batches
2. **Incremental Scanning**: Only scan changed components
3. **Custom Scanners**: Plugin architecture for additional scanners
4. **Webhook Events**: Emit events on scan completion
5. **Audit Trail**: Track all orchestration decisions
6. **Multi-Region**: Distribute workers across regions

## Related Documentation

- [OPERATIONS.md](../OPERATIONS.md) - API operations reference
- [CLAUDE.md](../CLAUDE.md) - Developer guide
- [AGENTS.md](../AGENTS.md) - Agent collaboration guide
- [BullMQ Docs](https://docs.bullmq.io/)
- [Prisma ORM](https://www.prisma.io/docs/)
- [Wasp Framework](https://wasp.sh/docs/)
