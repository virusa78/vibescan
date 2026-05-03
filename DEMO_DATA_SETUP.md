# Demo Data Setup Complete

## Summary

Successfully seeded VibeScan database with:
- **3 demo users** with realistic plans and credentials
- **775 total scans** across 6 months of historical data
- **7,657 total findings** with varying severity levels

## Demo User Credentials

| Email | Password | Plan | Region | Scans | Findings |
|-------|----------|------|--------|-------|----------|
| `arjun.mehta@finstack.io` | `vs_demo_pro_2026` | Pro | OTHER | 398 | 3,910 |
| `priya.sharma@devcraft.in` | `vs_demo_starter_2026` | Starter | IN | 99 | 962 |
| `rafael.torres@securecorp.com` | `vs_demo_ent_2026` | Enterprise | OTHER | 278 | 2,785 |

## Scan Data Characteristics

- **Time Period**: Last 6 months
- **Scan Distribution**: Varies per plan (Pro: 50-100/month, Starter: 10-30/month, Enterprise: 30-60/month)
- **Findings per Scan**: 5-15 vulnerabilities randomly selected
- **CVE Database**: 15 realistic CVEs with CVSS scores and severity levels
- **Sources**: All findings marked as 'grype' scanner source

## Database Schema

- **Scans Table**: 775 rows with inputType='source_zip', status='done'
- **Findings Table**: 7,657 rows with fingerprints, severity levels, CVSS scores
- **Users Table**: 3 rows with correct authentication hashes and plan tiers

## Seeding Scripts

Two seed scripts were created in `wasp-app/`:

1. **seed-demo.mjs** - Creates demo users (emails, passwords, plans)
   - Imports Prisma client and bcrypt for password hashing
   - Handles duplicate user detection

2. **seed-demo-scans.mjs** - Creates 6 months of scan history and findings
   - Generates randomized scan dates across 6-month period
   - Creates unique findings per scan using SHA256 fingerprints
   - Updates user quota tracking

## Database Migrations

Applied missing migration during setup:
- `20260422110000_q3_team_features_ui_prefs` - Added ui_preferences column to users table
- Updated `ScanSource` enum from old values ('free', 'enterprise') to new values ('grype', 'codescoring_johnny', 'snyk')
- Added `planned_sources` column to scans table

## How to Re-seed

```bash
cd wasp-app

# Reset to clean state (if needed)
export DATABASE_URL="postgresql://vibescan:vibescan@localhost:5432/vibescan"
npx prisma migrate reset --force

# Create demo users
node seed-demo.mjs

# Create historical scan data
node seed-demo-scans.mjs
```

## Verification

Verify data in database:
```sql
SELECT email, COUNT(*) as scans
FROM users u
LEFT JOIN scans s ON u.id = s.user_id
GROUP BY u.email;
```

Expected output:
```
arjun.mehta@finstack.io      | 398
priya.sharma@devcraft.in     | 99
rafael.torres@securecorp.com | 278
```

## Next Steps

- Start Wasp dev server: `cd wasp-app && PORT=3555 wasp start`
- Login with any of the demo credentials above
- Dashboard will show scans, findings, and quota usage
- Test scan submission, webhook delivery, and reporting features

---

**Completed**: May 2, 2026  
**Database**: PostgreSQL (vibescan @ localhost:5432)  
**Wasp Version**: 0.23+  
**Status**: ✅ Ready for testing
