# PRODUCTION_CHECKLIST.md

Deployment readiness verification for VibeScan Phase 5 (Production Release).

## Pre-Deployment Verification

### ✅ Code Quality

- [ ] **ESLint**: `npm run lint` passes with 0 errors
  ```bash
  npm run lint
  # Expected: ✖ X problems (0 errors, X warnings)
  ```

- [ ] **TypeScript**: Type checking passes
  ```bash
  npx tsc --noEmit
  # Expected: No errors
  ```

- [ ] **Build**: Production build succeeds
  ```bash
  cd wasp-app && wasp build
  # Expected: Build output in .wasp/build/
  ```

### ✅ Testing

- [ ] **Unit Tests**: All pass
  ```bash
  npm test
  # Expected: All tests pass
  ```

- [ ] **Integration Tests**: All pass
  ```bash
  npm test -- test/integration/
  # Expected: All tests pass
  ```

- [ ] **E2E Tests**: All pass
  ```bash
  npx playwright test test/e2e/
  # Expected: All tests pass
  ```

- [ ] **Coverage**: Meets requirements
  ```bash
  npm run test:coverage:gate
  # Expected: Gate passes
  ```

### ✅ Security

- [ ] **Dependency Audit**: No critical/high vulnerabilities
  ```bash
  npm audit
  # Expected: No critical/high issues (or acceptable risks documented)
  ```

- [ ] **API Key Security**: 
  - [ ] Raw keys never logged
  - [ ] Keys stored as bcrypt hashes
  - [ ] API keys returned only at generation

- [ ] **Webhook Security**:
  - [ ] HMAC-SHA256 signing implemented
  - [ ] Signature verification on incoming webhooks
  - [ ] No raw secrets in logs

- [ ] **Authentication**:
  - [ ] JWT tokens used for session management
  - [ ] Access tokens expire (15 min)
  - [ ] Refresh tokens expire (30 days)
  - [ ] All protected endpoints require auth

- [ ] **Database**:
  - [ ] User ownership enforced in queries
  - [ ] No SQL injection vulnerabilities (using Prisma ORM)
  - [ ] Sensitive data encrypted (if applicable)

### ✅ Database

- [ ] **Migrations**: All 14 migrations applied and tested
  ```bash
  cd wasp-app && wasp db migrate-dev
  # Expected: All migrations applied
  ```

- [ ] **Schema**: Prisma schema matches database
  ```bash
  cd wasp-app && wasp db push
  # Expected: Schema synced
  ```

- [ ] **Seeding**: Test data seeded successfully
  ```bash
  cd wasp-app && wasp db seed
  # Expected: Seed data inserted
  ```

### ✅ Configuration

- [ ] **Environment Variables**: All required vars documented
  - [ ] `.env.example` contains all needed vars
  - [ ] `PORT=3555` set in `.env.server`
  - [ ] `DATABASE_URL` configured
  - [ ] `REDIS_URL` configured
  - [ ] `JWT_SECRET` set (production value)
  - [ ] `ENCRYPTION_KEY` set (production value)
  - [ ] `STRIPE_SECRET_KEY` configured
  - [ ] `AWS_*` credentials configured

- [ ] **Email Configuration**:
  - [ ] Email provider configured (not Dummy)
  - [ ] Sender address valid
  - [ ] Email templates tested

- [ ] **CORS**: Frontend origin allowed
  - [ ] Configured in Wasp server middleware
  - [ ] No overly permissive wildcards

### ✅ API & Operations

- [ ] **All 20 Operations Functional**:
  - [ ] User Management (3): getPaginatedUsers, updateIsUserAdminById, updateUserSettings
  - [ ] API Keys (3): generateApiKey, listApiKeys, revokeApiKey
  - [ ] Scans (3): getScans, getScanById, submitScan
  - [ ] Reports (4): getReport, getReportSummary, generateReportPDF, getCIDecision
  - [ ] Webhooks (5): createWebhook, listWebhooks, getWebhook, updateWebhook, deleteWebhook
  - [ ] Billing (2): getCustomerPortalUrl, generateCheckoutSession

- [ ] **Error Handling**: All operations return standard error format
  - [ ] 401 for unauthorized
  - [ ] 403 for forbidden
  - [ ] 404 for not found
  - [ ] 422 for validation error
  - [ ] 429 for rate limited
  - [ ] 402 for quota exceeded

- [ ] **Swagger Documentation**: OpenAPI docs accessible
  - [ ] `GET /docs` returns interactive docs
  - [ ] `GET /openapi.json` returns spec
  - [ ] All operations documented

### ✅ Frontend

- [ ] **Pages Load**: All routes work
  - [ ] `/login` - Login page
  - [ ] `/signup` - Registration page
  - [ ] `/dashboard` - Dashboard (protected)
  - [ ] `/api-keys` - API keys page (protected)
  - [ ] `/webhooks` - Webhooks page (protected)
  - [ ] `/reports` - Reports page (protected)

- [ ] **No Console Errors**: Browser console clean
  - [ ] No TypeScript errors
  - [ ] No 404s for assets
  - [ ] No CORS errors

- [ ] **Responsive Design**: Works on mobile/desktop
  - [ ] Sidebar collapses on mobile
  - [ ] Tables scrollable on small screens
  - [ ] Forms usable on all sizes

### ✅ Performance

- [ ] **Bundle Size**: Reasonable for production
  - [ ] Frontend bundle < 1MB gzipped
  - [ ] No unused dependencies
  - [ ] Tree-shaking working

- [ ] **Database Queries**: Efficient
  - [ ] No N+1 queries
  - [ ] Indexes on frequently queried columns
  - [ ] Pagination implemented for lists

- [ ] **Caching**: Redis utilized properly
  - [ ] Session data cached
  - [ ] Quota info cached
  - [ ] Cache invalidation working

### ✅ Monitoring & Logging

- [ ] **Prometheus Metrics**: Available at `/metrics`
  - [ ] Request latency recorded
  - [ ] Error rates tracked
  - [ ] Queue depth monitored
  - [ ] Quota usage recorded

- [ ] **Structured Logging**:
  - [ ] Log levels (error, warn, info) properly set
  - [ ] Sensitive data never logged
  - [ ] Request IDs for tracing

- [ ] **Error Tracking**: Integration (if applicable)
  - [ ] Sentry/Rollbar configured (optional)
  - [ ] Error notifications enabled

### ✅ Backup & Recovery

- [ ] **Database Backups**: Strategy defined
  - [ ] Automated daily backups
  - [ ] Point-in-time recovery tested
  - [ ] Backup retention policy set

- [ ] **Disaster Recovery**: Plan documented
  - [ ] RTO/RPO defined
  - [ ] Failover procedure documented
  - [ ] Recovery tested

### ✅ Documentation

- [ ] **Developer Documentation**: Complete
  - [ ] [CLAUDE.md](CLAUDE.md) updated
  - [ ] [AGENTS.md](AGENTS.md) updated
  - [ ] [OPERATIONS.md](OPERATIONS.md) created
  - [ ] README.md updated

- [ ] **Deployment Guide**: Written
  - [ ] Startup procedure documented
  - [ ] Configuration steps clear
  - [ ] Troubleshooting guide included

- [ ] **API Documentation**: Available
  - [ ] Swagger/OpenAPI docs accessible
  - [ ] cURL examples provided
  - [ ] Error codes documented

## Deployment Steps

### 1. Pre-Deployment

```bash
# Verify everything locally
cd /home/virus/vibescan

# Run all checks
npm run lint
npx tsc --noEmit
npm test
npm run test:coverage:gate

# Build production bundle
cd wasp-app
wasp build
```

### 2. Environment Setup

```bash
# Configure production .env
# Copy .env.example to .env.server and update:
PORT=3555
DATABASE_URL=postgresql://user:password@prod-db:5432/vibescan
REDIS_URL=redis://prod-redis:6379
JWT_SECRET=<production-secret>
ENCRYPTION_KEY=<32-char-key>
STRIPE_SECRET_KEY=<stripe-prod-key>
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=<prod-key>
AWS_SECRET_ACCESS_KEY=<prod-secret>
```

### 3. Database Setup

```bash
# Run migrations on production database
cd wasp-app
DATABASE_URL=<prod-url> wasp db push
DATABASE_URL=<prod-url> wasp db migrate-dev
```

### 4. Deploy to Railway

```bash
cd wasp-app
wasp deploy railway
```

**Steps**:
1. Link Railway project: `wasp deploy railway --link`
2. Set environment variables in Railway dashboard
3. Deploy: `wasp deploy railway --build`
4. Monitor logs: `wasp logs railway`

### 5. Deploy to Fly.io

```bash
cd wasp-app
wasp deploy fly
```

**Steps**:
1. Authenticate: `fly auth login`
2. Create app: `fly apps create vibescan`
3. Deploy: `wasp deploy fly --build`
4. Check status: `fly status`

### 6. Post-Deployment Verification

```bash
# Test API endpoints
curl https://app.vibescan.app/docs                # Swagger docs
curl https://app.vibescan.app/metrics             # Prometheus metrics

# Monitor logs
# Railway: Dashboard → Logs
# Fly.io: fly logs

# Test user flows
# 1. Register new account
# 2. Generate API key
# 3. Submit scan
# 4. View report
# 5. Create webhook
```

## Rollback Procedure

If deployment fails:

```bash
# Rollback to previous version
cd wasp-app

# Railway
wasp deploy railway --rollback

# Fly.io
fly releases list
fly releases rollback
```

## Post-Deployment Monitoring

### Daily Checks

- [ ] API availability: `curl https://app.vibescan.app/health`
- [ ] Error rate: Check Prometheus dashboard
- [ ] Performance: Monitor response times
- [ ] User activity: Check dashboard metrics

### Weekly Review

- [ ] Database size: Monitor growth
- [ ] Backup status: Verify backups running
- [ ] Security scans: Run npm audit
- [ ] Log review: Check for unusual patterns

### Monthly Review

- [ ] Capacity planning: Do we need to scale?
- [ ] Cost analysis: Review infrastructure costs
- [ ] Security audit: Full security review
- [ ] Performance optimization: Identify slow endpoints

## Success Criteria

✅ **Deployment Successful When**:
1. All tests pass locally
2. Build succeeds without errors
3. Environment variables configured
4. Database migrations applied
5. API endpoints respond correctly
6. Frontend loads without errors
7. User can register and login
8. Swagger docs accessible
9. Prometheus metrics available
10. No critical errors in logs

---

**Deployment Date**: _______________  
**Deployed By**: _______________  
**Verified By**: _______________  
**Status**: 🟢 Production Ready

---

Last Updated: April 2026  
Wasp Version: 0.23+  
Node.js: 24.14.1 LTS
