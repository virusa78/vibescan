#!/bin/bash

# Phase 5 E2E Test Verification Script
# Verifies all test files are in place and discoverable

set -e

echo "================================"
echo "Phase 5 E2E Test Verification"
echo "================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check test directory structure
echo "📁 Checking test directory structure..."
echo ""

if [ -d "test/e2e-wasp" ]; then
    echo -e "${GREEN}✓${NC} test/e2e-wasp directory exists"
else
    echo -e "${RED}✗${NC} test/e2e-wasp directory missing"
    exit 1
fi

# Check for all required test files
echo ""
echo "📋 Checking test files..."

test_files=(
    "test/e2e-wasp/sbom-upload-e2e.spec.ts"
    "test/e2e-wasp/github-url-e2e.spec.ts"
    "test/e2e-wasp/zip-upload-e2e.spec.ts"
    "test/e2e-wasp/complete-happy-path.spec.ts"
    "test/e2e-wasp/helpers.ts"
    "test/e2e-wasp/global-setup.ts"
    "test/e2e-wasp/README.md"
)

for file in "${test_files[@]}"; do
    if [ -f "$file" ]; then
        lines=$(wc -l < "$file")
        echo -e "${GREEN}✓${NC} $file ($lines lines)"
    else
        echo -e "${RED}✗${NC} $file missing"
        exit 1
    fi
done

# Check fixtures
echo ""
echo "📦 Checking test fixtures..."

if [ -f "test/fixtures/sample.sbom.json" ]; then
    size=$(du -h "test/fixtures/sample.sbom.json" | cut -f1)
    echo -e "${GREEN}✓${NC} test/fixtures/sample.sbom.json ($size)"
else
    echo -e "${RED}✗${NC} test/fixtures/sample.sbom.json missing"
    exit 1
fi

# Check Playwright configuration
echo ""
echo "⚙️  Checking Playwright configuration..."

if grep -q 'testDir: "./test/e2e-wasp"' playwright.wasp.config.ts; then
    echo -e "${GREEN}✓${NC} playwright.wasp.config.ts configured correctly"
else
    echo -e "${RED}✗${NC} playwright.wasp.config.ts not configured"
    exit 1
fi

# Discover tests
echo ""
echo "🔍 Discovering tests with Playwright..."
echo ""

# Count total test specs
test_count=$(npx playwright test --list -c playwright.wasp.config.ts 2>&1 | grep "Total:" | awk '{print $2}')

if [ ! -z "$test_count" ] && [ "$test_count" -gt "0" ]; then
    echo -e "${GREEN}✓${NC} Found $test_count tests"
    echo ""
    npx playwright test --list -c playwright.wasp.config.ts | grep "›"
else
    echo -e "${RED}✗${NC} No tests discovered"
    exit 1
fi

# Summary
echo ""
echo "================================"
echo "✅ Phase 5 E2E Tests Ready"
echo "================================"
echo ""
echo "To run the tests:"
echo ""
echo "1. Start the Wasp backend in one terminal:"
echo "   cd wasp-app"
echo "   PORT=3555 wasp start"
echo ""
echo "2. Run E2E tests in another terminal:"
echo "   npm run test:e2e"
echo ""
echo "Or run specific tests:"
echo "   npx playwright test test/e2e-wasp/sbom-upload-e2e.spec.ts"
echo "   npx playwright test -g 'SBOM Upload'"
echo "   npx playwright test test/e2e-wasp --headed"
echo "   npx playwright test test/e2e-wasp --debug"
echo ""
echo "View results:"
echo "   npx playwright show-report"
echo ""
