# Quota Implementation - Validation Checklist

This document provides a step-by-step checklist to validate the Quota Ledger + Enforcement implementation.

## Pre-Deployment Checklist

### 1. Database Schema Verification

- [ ] QuotaLedger table exists with all columns:
  ```sql
  SELECT * FROM quota_ledger LIMIT 1;
  ```

- [ ] Columns present:
  ```
  ✓ id (UUID)
  ✓ created_at (DateTime)
  ✓ user_id (UUID, FK to users)
  ✓ action (String)
  ✓ amount (Int)
  ✓ reason (String, nullable)
  ✓ balance_before (Int)
  ✓ balance_after (Int)
  ✓ related_scan_id (UUID, nullable)
  ```

- [ ] Indexes created:
  ```sql
  SELECT * FROM pg_indexes WHERE tablename = 'quota_ledger';
  ```

- [ ] User model has relation:
  ```sql
  -- Should return quota_ledger entries
  SELECT * FROM quota_ledger WHERE user_id = '<test-user-id>';
  ```

### 2. Code Files Verification

- [ ] `/wasp-app/schema.prisma`
  - [ ] QuotaLedger model added with all fields
  - [ ] User.quotaLedger relation added
  - [ ] Indexes on userId and createdAt

- [ ] `/wasp-app/src/server/config/quotas.ts`
  - [ ] QUOTA_LIMITS object defined for all plans
  - [ ] free_trial: 5
  - [ ] starter: 50
  - [ ] pro: 500
  - [ ] enterprise: Infinity
  - [ ] Helper functions: getQuotaLimitForPlan, isUnlimitedQuota

- [ ] `/wasp-app/src/server/services/quotaService.ts`
  - [ ] QuotaService class defined
  - [ ] All 5 methods implemented:
    - [ ] getQuota()
    - [ ] canScan()
    - [ ] consumeQuota()
    - [ ] refundQuota()
    - [ ] getLedgerEntries()
  - [ ] Singleton instance exported

- [ ] `/wasp-app/src/server/operations/scans/submitScan.ts`
  - [ ] Imports quotaService
  - [ ] Calls quotaService.consumeQuota() in transaction
  - [ ] Response includes quota_remaining
  - [ ] Throws HttpError(429) on quota exceeded

- [ ] `/wasp-app/tests/quotaService.test.ts`
  - [ ] All test suites present
  - [ ] beforeEach/afterEach cleanup
  - [ ] Concurrency tests included

- [ ] `/OPERATIONS.md`
  - [ ] "Quota Management" section added
  - [ ] Plan limits documented
  - [ ] Usage examples provided
  - [ ] Error codes documented

### 3. Unit Test Execution

```bash
cd /home/virus/vibescan
npm test -- wasp-app/tests/quotaService.test.ts
```

- [ ] All tests pass
- [ ] Output shows:
  ```
  ✓ getQuota returns correct quota info
  ✓ getQuota handles non-existent user
  ✓ getQuota resets quota when reset date passed
  ✓ canScan returns true when quota available
  ✓ canScan returns false when quota exceeded
  ✓ consumeQuota consumes quota within transaction
  ✓ consumeQuota throws 429 when quota exceeded
  ✓ consumeQuota handles unlimited enterprise quota
  ✓ consumeQuota requires transaction
  ✓ refundQuota refunds quota
  ✓ refundQuota does not refund below zero
  ✓ refundQuota records reason in ledger
  ✓ getLedgerEntries retrieves entries
  ✓ getLedgerEntries respects limit parameter
  ✓ getLedgerEntries orders by most recent first
  ✓ Plan limits: starter (50)
  ✓ Plan limits: free_trial (5)
  ✓ Plan limits: pro (500)
  ✓ Concurrency: handles concurrent quota consumption
  ```

### 4. Integration Test Execution

```bash
cd /home/virus/vibescan
npm test -- wasp-app/tests/phase5-submitScan.e2e.test.ts
```

- [ ] submitScan includes quota_remaining in response
- [ ] Quota decrements on submission
- [ ] Quota refunds on scan failure
- [ ] Monthly reset works correctly

### 5. Manual Testing (After wasp start)

Start the dev server:
```bash
cd wasp-app
PORT=3555 wasp start
```

#### Test 5.1: Normal Scan Submission

```bash
# 1. Create user (register)
# 2. Check initial quota
curl http://localhost:3555/api/quota/info \
  -H "Authorization: Bearer $TOKEN"

# Expected response:
# {
#   "used": 0,
#   "limit": 50,
#   "remaining": 50,
#   "resetDate": "2024-05-01T00:00:00Z"
# }

# 3. Submit scan
curl -X POST http://localhost:3555/api/scans \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"inputRef": "app.zip", "inputType": "source_zip"}'

# Expected response includes:
# {
#   "id": "scan-123",
#   "quota_remaining": 49
# }

# 4. Verify ledger entry created
```

- [ ] Response includes quota_remaining
- [ ] Value is 49 (50 - 1)

#### Test 5.2: Quota Exceeded

```bash
# 1. Use up all quota (script to submit 50 scans)
for i in {1..50}; do
  curl -X POST http://localhost:3555/api/scans \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"inputRef\": \"app$i.zip\", \"inputType\": \"source_zip\"}"
done

# 2. Try to submit one more (should fail)
curl -X POST http://localhost:3555/api/scans \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"inputRef": "app51.zip", "inputType": "source_zip"}'

# Expected response (HTTP 429):
# {
#   "statusCode": 429,
#   "message": "Monthly scan quota exceeded",
#   "error": "quota_exceeded",
#   "quota_limit": 50,
#   "quota_used": 50,
#   "quota_remaining": 0
# }
```

- [ ] HTTP status 429
- [ ] Error message mentions quota exceeded
- [ ] Details show limit and current usage

#### Test 5.3: Quota Refund

```bash
# 1. Submit a scan
SCAN_ID=$(curl -s -X POST http://localhost:3555/api/scans \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"inputRef": "app.zip", "inputType": "source_zip"}' \
  | jq -r '.id')

# 2. Check quota (should be used)
curl http://localhost:3555/api/quota/info -H "Authorization: Bearer $TOKEN"
# Expected: "used": 1

# 3. Fail the scan (admin action or worker)
# Admin endpoint to mark scan as failed
curl -X PATCH http://localhost:3555/api/scans/$SCAN_ID/fail \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"reason": "scanner_error"}'

# 4. Check quota again (should be refunded)
curl http://localhost:3555/api/quota/info -H "Authorization: Bearer $TOKEN"
# Expected: "used": 0

# 5. Check ledger has refund entry
curl http://localhost:3555/api/quota/ledger -H "Authorization: Bearer $TOKEN"
# Should include:
# { "action": "scan_refunded", "amount": -1, "reason": "scan_failed: scan-..." }
```

- [ ] Quota used increases on submit
- [ ] Quota used decreases on refund
- [ ] Ledger shows both entries

#### Test 5.4: Monthly Reset

```bash
# 1. Set user's quotaResetDate to yesterday
UPDATE users SET quota_reset_date = NOW() - INTERVAL '1 day' 
WHERE id = '<user-id>';

# 2. Call getQuota
curl http://localhost:3555/api/quota/info -H "Authorization: Bearer $TOKEN"

# 3. Check that quotaResetDate was updated
SELECT quota_reset_date FROM users WHERE id = '<user-id>';
# Should be next month's 1st

# 4. Check ledger has reset entry
SELECT * FROM quota_ledger 
WHERE user_id = '<user-id>' AND action = 'monthly_reset'
ORDER BY created_at DESC LIMIT 1;
```

- [ ] Quota reset date updated to next month
- [ ] Monthly reset entry logged in ledger

#### Test 5.5: Plan Limits

```bash
# Test each plan tier:

# Free Trial (5 scans)
UPDATE users SET plan = 'free_trial', monthly_quota_limit = 5 WHERE id = '<user-id>';
# Should allow 5 scans, fail on 6th

# Starter (50 scans)
UPDATE users SET plan = 'starter', monthly_quota_limit = 50 WHERE id = '<user-id>';
# Should allow 50 scans, fail on 51st

# Pro (500 scans)
UPDATE users SET plan = 'pro', monthly_quota_limit = 500 WHERE id = '<user-id>';
# Should allow 500 scans, fail on 501st

# Enterprise (unlimited)
UPDATE users SET plan = 'enterprise', monthly_quota_limit = 999999 WHERE id = '<user-id>';
# Should allow many scans, never fail for quota
```

- [ ] Each plan enforces correct limit
- [ ] Enterprise allows many submissions

### 6. Ledger Integrity Checks

```sql
-- Check for orphaned entries (referencing deleted users)
SELECT l.* FROM quota_ledger l
LEFT JOIN users u ON l.user_id = u.id
WHERE u.id IS NULL;
-- Should return 0 rows

-- Check for balance integrity (balanceAfter should match next balanceBefore)
SELECT l1.id, l1.balance_after, l2.balance_before
FROM quota_ledger l1
INNER JOIN quota_ledger l2 ON l1.user_id = l2.user_id 
  AND l1.created_at < l2.created_at
WHERE l1.balance_after != l2.balance_before
ORDER BY l1.user_id, l1.created_at;
-- Should return 0 rows

-- Check for correct amount values
SELECT * FROM quota_ledger 
WHERE action NOT IN ('scan_submitted', 'scan_refunded', 'monthly_reset');
-- Should return 0 rows

-- Verify amounts match action types
SELECT action, COUNT(*) as count, 
  COUNT(CASE WHEN amount = 1 THEN 1 END) as positive,
  COUNT(CASE WHEN amount = -1 THEN 1 END) as negative,
  COUNT(CASE WHEN amount = 0 THEN 1 END) as zero
FROM quota_ledger
GROUP BY action;
-- Should show: scan_submitted all positive, scan_refunded all negative, monthly_reset all zero
```

- [ ] No orphaned entries
- [ ] Balance chain integrity maintained
- [ ] Amount values correct for each action

### 7. Concurrent Requests Test

Use Apache Bench or similar to stress test:

```bash
# Create 50 concurrent scan requests (should only allow 50 for starter plan)
ab -n 50 -c 50 -p scan.json -T "application/json" \
  -H "Authorization: Bearer $TOKEN" \
  http://localhost:3555/api/scans

# Check results
- [ ] Exactly 50 succeed (HTTP 202)
- [ ] Any additional fail (HTTP 429)
- [ ] Database shows exactly 50 quota consumed
- [ ] Ledger has exactly 50 entries
```

### 8. Performance Checks

```sql
-- Check query performance for quota checks
EXPLAIN ANALYZE
SELECT u.*, q.* FROM users u
LEFT JOIN quota_ledger q ON u.id = q.user_id
WHERE u.id = '<user-id>'
ORDER BY q.created_at DESC
LIMIT 10;

-- Indexes should be used:
-- ✓ Index on quota_ledger.user_id
-- ✓ Index on quota_ledger.created_at
```

- [ ] Query uses indexes
- [ ] Execution time < 100ms

## Post-Deployment Checklist

- [ ] Quota system deployed to production
- [ ] All tests passing in CI/CD
- [ ] Zero errors in application logs
- [ ] Ledger entries appearing correctly
- [ ] Manual testing completed
- [ ] Documentation available to users
- [ ] Monitoring alerts set up
- [ ] Backup and recovery tested

## Rollback Plan (If Needed)

If quota system needs to be disabled:

1. Remove quota check from submitScan:
   ```typescript
   // Comment out or delete:
   // const quotaInfo = await quotaService.consumeQuota(...)
   ```

2. Database data is preserved - no migration needed
3. Redeploy: `wasp deploy railway`

## Support Resources

- **Implementation Details**: See `QUOTA_IMPLEMENTATION.md`
- **API Reference**: See `OPERATIONS.md` - Quota Management section
- **Service Code**: `wasp-app/src/server/services/quotaService.ts`
- **Tests**: `wasp-app/tests/quotaService.test.ts`

---

**Last Updated**: April 18, 2024
