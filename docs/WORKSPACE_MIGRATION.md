# Workspace Migration & Legacy Fallback Policy

## Overview

VibeScan has migrated from a **user-only** data model to a **workspace-scoped** model. This document defines the migration strategy, fallback behavior, and deprecation timeline.

## Migration Status

- **Completed**: Schema updated with `workspaceId` fields on all scoped entities
- **Completed**: All new scans/webhooks/API keys auto-populate `workspaceId`
- **In Progress**: Migrating existing data to workspace scope
- **Active**: Legacy fallback queries for pre-migration data

## Data Model Change

### Before (User-Only)
```sql
Scan: {
  id, userId, status, ...
}
```

**Scope**: User can only see their own scans.

### After (Workspace-Scoped)
```sql
Scan: {
  id, userId, workspaceId, status, ...
}
Workspace: {
  id, name, organization_id
}
WorkspaceMember: {
  id, workspace_id, user_id, role
}
```

**Scope**: All workspace members can see all workspace scans.

## Affected Entities

**Workspace-Scoped** (shared across members):
- `Scan` — workspace can see all scans
- `Finding` — inherited from Scan
- `Webhook` — workspace can use/manage
- `WebhookDelivery` — inherited from Webhook
- `ApiKey` — workspace can use/manage
- `ScanResult` — inherited from Scan
- `ScanDelta` — inherited from Scan
- `VulnAcceptance` — per-user acceptance of findings (queryable by workspace)

**User-Only** (not workspace-scoped):
- `User` profile (displayName, email, region)
- `UserNotification` preferences
- `ScannerAccessSettings` (Snyk, Codescoring tokens)

## Migration Strategy

### Phase 1: Backfill Existing Data

```sql
-- Backfill scans without workspaceId
UPDATE scan
SET workspaceId = (
  SELECT activeWorkspaceId FROM "user" WHERE "user".id = scan.userId
)
WHERE workspaceId IS NULL AND userId IS NOT NULL;

-- Similarly for webhooks, API keys, etc.
UPDATE webhook
SET workspaceId = (
  SELECT activeWorkspaceId FROM "user" WHERE "user".id = webhook.userId
)
WHERE workspaceId IS NULL AND userId IS NOT NULL;
```

### Phase 2: Verify Backfill

```bash
npm run verify:workspace-migration
```

Checks:
- ✅ All scans have workspaceId (except true legacy orphans)
- ✅ Workspace membership includes all migrated users
- ✅ No data leakage across workspaces after backfill
- ✅ Historical queries still work via fallback

### Phase 3: Monitor & Deprecate

**Timeline**:
- Months 1-3: Run migrations, monitor for errors
- Months 3-6: Gradual deprecation of legacy fallback
- Month 6: Remove legacy fallback code

## Legacy Fallback Queries

During migration, operations use fallback logic:

```typescript
// buildWorkspaceOrLegacyOwnerWhere generates:
WHERE (workspaceId = user.workspaceId)
   OR (workspaceId IS NULL AND userId = user.id)
```

**Why fallback?**
- Old data (pre-migration) has NULL `workspaceId`
- User's `activeWorkspaceId` may not match old scan's implied workspace
- Need to serve old scans during transition period

**When to remove fallback:**
- ✅ All production data is backfilled (workspaceId NOT NULL)
- ✅ No orphaned rows without workspaceId
- ✅ All users have activeWorkspaceId set
- ✅ Customer communication complete: old scans moved to appropriate workspace

## Deprecation Timeline

### Now (Month 0)
- ✅ New data: all workspace-scoped
- ✅ Queries: workspace-scoped + fallback
- ✅ Backfill: running in migration script
- Status: **Active Migration**

### Month 3
- ✅ Production: fully backfilled
- ✅ Orphaned data: documented and cleared
- ✅ Logs: show zero legacy fallback hits
- Proposed: Begin deprecation warnings in code
- Status: **Verify Migration Complete**

### Month 6
- ✅ Legacy fallback removed from all operations
- ✅ Code cleanup: remove buildWorkspaceOrLegacyOwnerWhere
- ✅ Use only buildWorkspaceScopedWhere
- Status: **Workspace-Only Era**

## Verification Queries

### Check migration progress
```sql
-- Count rows with workspaceId set
SELECT 
  'Scan' as table_name, COUNT(*) as total, COUNT(workspaceId) as migrated
FROM scan
UNION ALL
SELECT 'Webhook', COUNT(*), COUNT(workspaceId) FROM webhook
UNION ALL
SELECT 'ApiKey', COUNT(*), COUNT(workspaceId) FROM apiKey;
```

### Find orphaned rows
```sql
-- Scans without workspaceId and orphaned user
SELECT id, userId FROM scan
WHERE workspaceId IS NULL AND userId NOT IN (SELECT id FROM "user");
```

### Verify no cross-workspace leakage
```sql
-- Check that workspace members only see their workspace's data
SELECT COUNT(*) 
FROM scan s
JOIN workspace w ON s.workspaceId = w.id
WHERE w.id NOT IN (
  SELECT workspace_id FROM workspace_member WHERE user_id = s.userId
);
-- Should return 0
```

## Cleanup Steps

### After verification complete:

1. **Remove buildWorkspaceOrLegacyOwnerWhere**
   ```typescript
   // Before:
   WHERE: buildWorkspaceOrLegacyOwnerWhere(user)
   
   // After:
   WHERE: { workspaceId: user.workspaceId }
   ```

2. **Update all operations**
   - Replace legacy fallback helpers with simple `{ workspaceId: user.workspaceId }`
   - Files affected: ~30 operation files

3. **Remove legacy helper**
   - Delete `buildWorkspaceOrLegacyOwnerWhere()` function
   - Delete `buildWorkspaceScopedWhere()` if no longer needed

4. **Add deprecation warning** (before removal)
   ```typescript
   // Month 3: Add to buildWorkspaceOrLegacyOwnerWhere
   console.warn('[DEPRECATION] Legacy fallback query detected. Migrate workspaceId.');
   ```

## Implementation Checklist

- [ ] Schema migration: ✅ Complete (see prisma/migrations/)
- [ ] Backfill script: ✅ Complete (scripts/backfill-workspace.ts)
- [ ] All operations updated to workspace scope: ⏳ In Progress (PR 2)
- [ ] Integration tests added for scope isolation: ✅ Complete (test/integration/workspace-scope-isolation.test.ts)
- [ ] E2E tests for workspace workflows: ⏳ Pending (PR 5)
- [ ] Migration verification command: `npm run verify:workspace-migration`
- [ ] Documentation complete: ✅ This file
- [ ] Monitoring: Logs show zero legacy fallback after Month 3
- [ ] Deprecation warnings added: Month 3
- [ ] Legacy code removed: Month 6

## Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| **Incomplete backfill** | Verify: `COUNT(workspaceId)` = total rows after migration |
| **Users without activeWorkspaceId** | Ensure bootstrap creates default workspace on signup |
| **Cross-workspace leakage** | Test query in prod: verify no rows cross workspace boundary |
| **Old clients using legacy API** | Maintain fallback during transition, update client code in parallel |
| **Orphaned data** | Document policy: delete or assign to primary workspace user |

## Historical Context

**Why workspace-scoped?**
- Multi-team feature (Phase 7 of original roadmap)
- Allow workspace members to collaborate on scans
- Foundation for fine-grained RBAC (future)
- Support GitHub App: one app per workspace, all members see linked repos

**Why fallback?**
- Zero-downtime migration: old data stays readable during transition
- Gradual rollout: test workspace-scoped queries while fallback is active
- Debugging: if issue detected, can revert to fallback while investigating

## Next Steps

1. **Verify backfill** on dev database (external to sandbox)
2. **Run integration tests** to confirm scope isolation
3. **Monitor** logs for legacy fallback queries in production
4. **Plan deprecation** timeline with team
5. **Remove fallback** after 3-6 month buffer

---

**Last Updated**: May 2026  
**Status**: Active Migration (Phase 2)  
**Owner**: Engineering Team  
**Timeline**: 6 months to workspace-only era
