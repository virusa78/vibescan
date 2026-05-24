# VibeScan MVP Phase 5: End-to-End Integration Tests

## Overview

This directory contains comprehensive E2E tests for the VibeScan MVP, verifying the complete user journey from registration through scan submission and results display.

## Test Files

### 0. `ntn-smoke.spec.ts`
**Test 0: NTN Smoke**
- User Story: Register → scan → verify core surfaces across dashboard, scan details, report, settings, API keys, webhooks, and pricing
- Verifies:
  - Authentication and dashboard entry
  - New scan form and scanner lineup display
  - Real scan submission and scan-details completion
  - Report rendering and severity filters
  - Settings, API keys, webhooks, and pricing pages load
  - Non-core interface checks are soft so the smoke only fails on the core path

### 1. `sbom-upload-e2e.spec.ts`
**Test 1: SBOM Upload E2E**
- User Story: Register → Upload SBOM → See results on dashboard
- Verifies:
  - User registration and authentication
  - SBOM file upload and validation
  - Scan queuing and processing
  - Dashboard display of results
  - Full vulnerability visibility for starter plan
  - Severity breakdown display
  - Vulnerability table rendering

### 2. `github-url-e2e.spec.ts`
**Test 2: GitHub URL E2E**
- User Story: Register with pro plan → Enter GitHub URL → See full results
- Verifies:
  - GitHub URL validation
  - Repository cloning and component extraction
  - Dual-scanner execution (Grype + Enterprise)
  - Full vulnerability visibility
  - Delta calculation between scanners
  - Performance metrics

### 2b. `github-ci-decision-screenshots.spec.ts`
**Test 2b: CI Decision Screenshots**
- User Story: Register → seed a completed GitHub-style scan → inspect the CI decision in the report UI
- Verifies:
  - Dashboard loads with the seeded scan row
  - Scan details page renders from a completed scan
  - Report page shows the CI Decision card and threshold line
  - Multiple screenshots are captured for later visual review
  - Deterministic seeded data keeps the screenshots stable without waiting for workers

### 2c. `github-ux-screenshots.spec.ts`
**Test 2c: GitHub + Findings UX Screenshots**
- User Story: Register → inspect GitHub App setup → open Findings → triage a finding
- Verifies:
  - GitHub App setup page shows concrete missing-variable diagnostics
  - Findings overview renders seeded project findings and filters
  - Findings drawer shows status, severity, SLA, and triage actions
  - Pending triage state is captured while a mutation is intentionally delayed
  - Four screenshots are captured for later visual review

### 3. `zip-upload-e2e.spec.ts`
**Test 3: Source ZIP E2E**
- User Story: Upload ZIP file → Extract components → See results
- Verifies:
  - ZIP file upload and storage
  - Component extraction from manifest files
  - Scan processing for uploaded source
  - Results display
  - Dual-scanner execution

### 4. `complete-happy-path.spec.ts`
**Test 4: Complete Happy Path**
- Comprehensive MVP verification with all features
- 20-step user journey:
  1. Anonymous user lands on app
  2. See landing page
  3. Click "Sign up"
  4. Register new account
  5. Email verification (Wasp auth)
  6. Login redirect to dashboard
  7. Dashboard empty state
  8. Click "New Scan"
  9. Upload SBOM file
  10. Real-time polling with progress
  11. Progress bar and time estimate
  12. Scan completion and results
  13. Severity cards display
  14. Vulnerability table
  15. Click vulnerability for details
  16. Severity badge and CVSS score
  17. Full vulnerability visibility check
  18. Navigate back to dashboard
19. Scan in recent scans list
20. Metrics cards updated

### 5. `settings-api-keys-webhooks-billing.spec.ts`
**Test 5: Settings, API keys, webhooks, billing**
- User Story: Register → Update settings → Manage API keys → Configure webhooks → Review pricing
- Verifies:
  - User settings update and persistence
  - API key generation and revocation
  - Webhook creation and deletion
  - Billing navigation to pricing plans

## Test Utilities

### `helpers.ts`
Reusable test helpers:
- `registerUser()` - Create new account
- `loginUser()` - Login with credentials
- `logoutUser()` - Logout current user
- `uploadSbomFile()` - Upload SBOM for scanning
- `waitForScanCompletion()` - Poll for scan status
- `viewScanDetails()` - Navigate to scan details page
- `verifyScanPaywall()` - Verify vulnerability details are visible
- `verifyFindingsDisplay()` - Check findings table
- `getSeverityCardValue()` - Extract severity metric
- `generateTestEmail()` - Create unique test emails
- `checkForConsoleErrors()` - Monitor browser console

### `global-setup.ts`
Global test initialization:
- Verifies backend (http://127.0.0.1:3555) is running
- Verifies frontend (http://127.0.0.1:3000) is running
- Clears browser cache and cookies

## Test Fixtures

### `test/fixtures/sample.sbom.json`
Valid CycloneDX SBOM file with:
- 10 components (lodash, express, axios, react, webpack, typescript, jest, eslint, prettier, node-fetch)
- Valid schema compliance
- Used for SBOM upload tests

### `test/fixtures/app.zip` (Optional)
Sample source code ZIP file with:
- Node.js project structure
- package.json manifest
- Multiple source files
- Used for ZIP upload tests

## Running the Tests

### Prerequisites

1. **Auto-start is enabled by default**
   - The Playwright global setup starts the managed Wasp contour when backend or frontend are not ready.
   - Set `E2E_AUTO_START=false` if you want to manage the stack manually.

2. **Verify endpoints if you are debugging manually**
   - Backend: http://127.0.0.1:3555
   - Frontend: http://127.0.0.1:3000

### Run All E2E Tests

```bash
cd /home/virus/vibescan

# Run all E2E tests
npm run test:e2e

# Run the resilient NTN smoke only
npm run test:e2e:ntn

# Override endpoints explicitly
API_URL=http://127.0.0.1:3555 FRONTEND_URL=http://127.0.0.1:3000 npm run test:e2e

# Run with headed browser (see UI)
npx playwright test test/e2e-wasp --headed

# Run specific test file
npx playwright test test/e2e-wasp/sbom-upload-e2e.spec.ts

# Run specific test by name
npx playwright test -g "SBOM Upload E2E"

# Run with debug mode
npx playwright test test/e2e-wasp --debug

# View test report
npx playwright show-report
```

### Test Execution Flow

1. **Playwright global setup** runs first
   - Checks backend connectivity
   - Checks frontend connectivity
   - Auto-starts the managed Wasp contour if either endpoint is not ready and `E2E_AUTO_START` is not disabled

2. **Each test:**
   - Creates unique test user (email + password)
   - Registers and logs in
   - Performs test-specific actions
   - Cleans up on completion

3. **Test results:**
   - HTML report in `playwright-report/`
   - Screenshots captured on failure
   - Console errors logged
   - Local e2e screenshots and other artifacts land in `test-results/`; clear that directory only when you want a fresh run before another e2e pass

## Validation Points (All Tests)

✅ **Authentication**: No 401/403 errors  
✅ **Error Handling**: No unhandled exceptions  
✅ **Database Consistency**: Data saved correctly  
✅ **UI Responsiveness**: No hanging states  
✅ **Visibility**: Vulnerability details are always visible
✅ **Performance**: Acceptable latency (<30s per scan)  
✅ **Console**: No errors or warnings  

## Success Criteria

- [ ] All 5 E2E tests pass
- [ ] No console errors or warnings
- [ ] Tests pass consecutively (no flakiness)
- [ ] Database clean between tests
- [ ] Happy path completes in <5 minutes
- [ ] All payment tiers verified
- [ ] Screenshots captured on failure

## Implementation Details

### Test Architecture

```
test/e2e-wasp/
├── helpers.ts                      # Reusable test utilities
├── global-setup.ts                 # Playwright global setup
├── sbom-upload-e2e.spec.ts         # Test 1: SBOM upload
├── github-url-e2e.spec.ts          # Test 2: GitHub URL
├── github-ci-decision-screenshots.spec.ts # Test 2b: CI decision screenshots
├── github-ux-screenshots.spec.ts   # Test 2c: GitHub + Findings UX screenshots
├── zip-upload-e2e.spec.ts          # Test 3: ZIP upload
├── complete-happy-path.spec.ts    # Test 4: Complete flow
└── settings-api-keys-webhooks-billing.spec.ts # Test 5: Settings + admin flows

test/fixtures/
└── sample.sbom.json               # CycloneDX SBOM fixture
```

### Key Features

1. **User Isolation**: Each test creates unique email/user
2. **Real Polling**: Tests wait for actual scan completion
3. **Visibility Testing**: Verifies vulnerability details are always visible
4. **Error Capture**: Screenshots on failure, console logs
5. **Performance Metrics**: Timing information logged
6. **Reusable Helpers**: Common operations abstracted

## Troubleshooting

### "Connection refused" Error

```bash
# Backend not running
cd /home/virus/vibescan/wasp-app
PORT=3555 wasp start

# In another terminal:
cd /home/virus/vibescan
npm run test:e2e
```

### "Tests not found"

Ensure test files are in `test/e2e-wasp/` and end with `.spec.ts`

### Tests timing out

- Increase timeout in individual tests
- Check network connectivity
- Verify database is accessible

### Flaky tests

- Tests use 2s polling intervals - may need adjustment for slower systems
- Increase `maxPolls` or `pollInterval` in helpers
- Check for stale test data

## Performance Benchmarks

**Target times for Phase 5 MVP:**
- SBOM Upload: < 30 seconds
- GitHub URL Scan: < 60 seconds
- ZIP Upload: < 30 seconds
- Complete Happy Path: < 5 minutes

## Git Commit

When tests pass:

```bash
git add test/e2e-wasp/ test/fixtures/

git commit -m "feat(mvp-p5): Add E2E integration tests - SBOM, GitHub, ZIP, complete happy path

- GitHub URL E2E test (full details for pro plan)
- Dashboard proofpack using GitHub repo scan
- Complete happy path E2E test (20 steps)
- Playwright helpers and global setup
- Test fixtures (sample.sbom.json)

All tests verify:
✓ User registration and authentication
✓ Scan submission and processing
✓ Dashboard display of results
✓ Paywall enforcement (starter = counts only)
✓ Findings display with severity
✓ No console errors or 401/403/500 errors
✓ Performance within acceptable limits

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

## Next Steps

1. ✅ E2E tests implemented
2. ⏳ Run tests with Wasp backend
3. ⏳ Debug and fix failing tests
4. ⏳ Document any gaps or limitations
5. ⏳ Commit to git
6. ⏳ Mark Phase 5 COMPLETE

## References

- Playwright Documentation: https://playwright.dev
- Wasp Documentation: https://wasp.sh
- Test Configuration: `playwright.wasp.config.ts`
- Main Wasp App: `wasp-app/main.wasp`

---

**Phase 5 Complete E2E Integration Tests for VibeScan MVP**  
Created: April 18, 2024  
Status: Ready for execution
