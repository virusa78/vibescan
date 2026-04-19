# VibeScan MVP Phase 5: End-to-End Integration Tests

## Overview

This directory contains comprehensive E2E tests for the VibeScan MVP, verifying the complete user journey from registration through scan submission and results display.

## Test Files

### 1. `sbom-upload-e2e.spec.ts`
**Test 1: SBOM Upload E2E**
- User Story: Register → Upload SBOM → See results on dashboard
- Verifies:
  - User registration and authentication
  - SBOM file upload and validation
  - Scan queuing and processing
  - Dashboard display of results
  - Paywall enforcement for starter plan
  - Severity breakdown display
  - Vulnerability table rendering

### 2. `github-url-e2e.spec.ts`
**Test 2: GitHub URL E2E**
- User Story: Register with pro plan → Enter GitHub URL → See full results
- Verifies:
  - GitHub URL validation
  - Repository cloning and component extraction
  - Dual-scanner execution (Grype + Enterprise)
  - Pro plan full details access (no paywall)
  - Delta calculation between scanners
  - Performance metrics

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
  17. Paywall enforcement check
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
- `verifyScanPaywall()` - Verify plan-based visibility rules
- `verifyFindingsDisplay()` - Check findings table
- `getSeverityCardValue()` - Extract severity metric
- `generateTestEmail()` - Create unique test emails
- `checkForConsoleErrors()` - Monitor browser console

### `global-setup.ts`
Global test initialization:
- Verifies backend (http://192.168.1.17:3555) is running
- Verifies frontend (http://192.168.1.17:3000) is running
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

1. **Start the Wasp backend:**
   ```bash
   cd /home/virus/vibescan/wasp-app
   PORT=3555 wasp start
   ```
   Wait for: `✓ Server running at http://192.168.1.17:3555`

2. **Verify frontend loads:**
   - Frontend should be available at http://192.168.1.17:3000
   - Wasp start command handles this automatically

### Run All E2E Tests

```bash
cd /home/virus/vibescan

# Run all E2E tests
npm run test:e2e

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

2. **Each test:**
   - Creates unique test user (email + password)
   - Registers and logs in
   - Performs test-specific actions
   - Cleans up on completion

3. **Test results:**
   - HTML report in `playwright-report/`
   - Screenshots captured on failure
   - Console errors logged

## Validation Points (All Tests)

✅ **Authentication**: No 401/403 errors  
✅ **Error Handling**: No unhandled exceptions  
✅ **Database Consistency**: Data saved correctly  
✅ **UI Responsiveness**: No hanging states  
✅ **Paywall Enforcement**: Plan visibility rules enforced  
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
├── zip-upload-e2e.spec.ts          # Test 3: ZIP upload
├── complete-happy-path.spec.ts    # Test 4: Complete flow
└── settings-api-keys-webhooks-billing.spec.ts # Test 5: Settings + admin flows

test/fixtures/
└── sample.sbom.json               # CycloneDX SBOM fixture
```

### Key Features

1. **User Isolation**: Each test creates unique email/user
2. **Real Polling**: Tests wait for actual scan completion
3. **Paywall Testing**: Verifies plan-based visibility rules
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

- SBOM upload E2E test (paywall verification for starter)
- GitHub URL E2E test (full details for pro plan)
- Source ZIP E2E test
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
