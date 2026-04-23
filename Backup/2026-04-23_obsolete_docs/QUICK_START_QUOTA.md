# Quick Start: Quota Ledger System

## In 30 Seconds

VibeScan now has plan-based monthly quota limits (5/50/500/∞) with full audit trail. Quota is consumed when scans are submitted and can be refunded on failure.

## What Changed?

### Database
- New `quota_ledger` table tracks every quota operation
- Automatically created by running `wasp db migrate-dev`

### Code
- `quotaService` handles all quota logic
- `submitScan` now returns `quota_remaining`
- HTTP 429 thrown when quota exceeded

### API Response
```json
{
  "scanId": "scan-123",
  "status": "queued",
  "quota_remaining": 49    // ← NEW
}
```

## How to Deploy

```bash
# 1. Create the table
cd wasp-app && wasp db migrate-dev

# 2. Run tests to verify
npm test -- wasp-app/tests/quotaService.test.ts

# 3. Deploy
wasp deploy railway
```

## Key Files

| File | Purpose |
|------|---------|
| `wasp-app/src/server/services/quotaService.ts` | Core quota logic |
| `wasp-app/src/server/config/quotas.ts` | Plan limits |
| `wasp-app/tests/quotaService.test.ts` | Tests (20+ cases) |
| `QUOTA_IMPLEMENTATION.md` | Full developer guide |
| `QUOTA_VALIDATION.md` | Testing guide |
| `OPERATIONS.md` | API reference (Quota section) |

## Quick Reference

### Check Quota
```typescript
const quota = await quotaService.getQuota(userId);
// { used: 10, limit: 50, remaining: 40, resetDate: Date }
```

### Get Audit Trail
```typescript
const entries = await quotaService.getLedgerEntries(userId, 10);
// [{ action: 'scan_submitted', amount: 1, ... }, ...]
```

### Refund Quota
```typescript
await quotaService.refundQuota(userId, scanId, 'scan_failed');
```

## Error Codes

**HTTP 429 - Quota Exceeded**
```json
{
  "statusCode": 429,
  "message": "Monthly scan quota exceeded",
  "data": {
    "quota_limit": 50,
    "quota_used": 50,
    "quota_remaining": 0
  }
}
```

## Plan Limits

- **free_trial**: 5 scans/month
- **starter**: 50 scans/month  
- **pro**: 500 scans/month
- **enterprise**: Unlimited

## Testing

```bash
# Run all quota tests
npm test -- wasp-app/tests/quotaService.test.ts

# Expected: All 20+ tests pass ✅
```

## Next Steps

1. ✅ Review this guide
2. ⏳ Run migration: `wasp db migrate-dev`
3. ⏳ Run tests: `npm test`
4. ⏳ Deploy to staging
5. ⏳ Test with real scans
6. ⏳ Deploy to production

## Questions?

- **How it works**: See `QUOTA_IMPLEMENTATION.md`
- **How to test**: See `QUOTA_VALIDATION.md`
- **API reference**: See `OPERATIONS.md`
- **Code review**: See `wasp-app/src/server/services/quotaService.ts`

---

**Status**: Ready to deploy ✅
