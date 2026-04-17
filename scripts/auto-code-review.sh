#!/bin/bash
#
# Auto Code Review Agent
# Triggered when commits have 200-300 lines of changes
# Usage: ./scripts/auto-code-review.sh [branch/commit]
#

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
MIN_LINES=200
MAX_LINES=300
REVIEW_THRESHOLD=$MIN_LINES

# Get commit info
TARGET=${1:-HEAD}

# Calculate total changes more reliably
if [ "$TARGET" = "HEAD" ]; then
    DIFF_STAT=$(git diff HEAD~1..HEAD --numstat 2>/dev/null || git diff --cached --numstat 2>/dev/null)
else
    DIFF_STAT=$(git diff "$TARGET"~1.."$TARGET" --numstat 2>/dev/null || git show "$TARGET" --numstat 2>/dev/null)
fi

# Parse numstat output: sum additions column
TOTAL_CHANGES=$(echo "$DIFF_STAT" | awk '{sum += $1} END {print sum}')

# Fallback to stat if numstat failed
if [ -z "$TOTAL_CHANGES" ] || [ "$TOTAL_CHANGES" = "0" ]; then
    if [ "$TARGET" = "HEAD" ]; then
        DIFF_STAT=$(git diff HEAD~1..HEAD --stat 2>/dev/null || git diff --cached --stat 2>/dev/null)
    else
        DIFF_STAT=$(git diff "$TARGET"~1.."$TARGET" --stat 2>/dev/null || git show "$TARGET" --stat 2>/dev/null)
    fi
    # Extract total insertions from stat summary line
    TOTAL_CHANGES=$(echo "$DIFF_STAT" | tail -1 | grep -oE '[0-9]+ insertion' | grep -oE '[0-9]+' || echo "0")
fi

# Ensure it's a number
if ! [[ "$TOTAL_CHANGES" =~ ^[0-9]+$ ]]; then
    TOTAL_CHANGES=0
fi

echo -e "${BLUE}╔════════════════════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║             🤖 AUTOMATIC CODE REVIEW AGENT - VIBESCAN                        ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${YELLOW}📊 Change Analysis:${NC}"
echo "   Target: $TARGET"
echo "   Total changes: ~$TOTAL_CHANGES lines"
echo "   Threshold: $REVIEW_THRESHOLD lines minimum"
echo ""

# Check if changes meet threshold
if [ "$TOTAL_CHANGES" -lt "$REVIEW_THRESHOLD" ]; then
    echo -e "${GREEN}✓ Changes below threshold ($TOTAL_CHANGES < $REVIEW_THRESHOLD)${NC}"
    echo "   Skipping automatic code review."
    exit 0
fi

if [ "$TOTAL_CHANGES" -gt "$MAX_LINES" ]; then
    echo -e "${YELLOW}⚠ Changes exceed max review size ($TOTAL_CHANGES > $MAX_LINES)${NC}"
    echo "   Please split into smaller PRs for better review quality."
    echo "   Proceeding with review anyway..."
    echo ""
fi

echo -e "${GREEN}✅ Code Review Triggered!${NC}"
echo "   Running comprehensive code analysis..."
echo ""

# Get commit details
COMMIT_SHA=$(git rev-parse "$TARGET" 2>/dev/null || echo "unknown")
COMMIT_MSG=$(git log -1 --pretty=%B "$TARGET" 2>/dev/null || echo "No message")
AUTHOR=$(git log -1 --pretty=%an "$TARGET" 2>/dev/null || echo "Unknown")

echo -e "${BLUE}Commit Information:${NC}"
echo "   SHA: ${COMMIT_SHA:0:8}"
echo "   Author: $AUTHOR"
echo "   Message: ${COMMIT_MSG:0:60}..."
echo ""

# Get changed files
if [ "$TARGET" = "HEAD" ]; then
    CHANGED_FILES=$(git diff HEAD~1..HEAD --name-only 2>/dev/null || git diff --cached --name-only 2>/dev/null)
else
    CHANGED_FILES=$(git diff "$TARGET"~1.."$TARGET" --name-only 2>/dev/null || git show "$TARGET" --name-only --pretty='' 2>/dev/null)
fi

FILE_COUNT=$(echo "$CHANGED_FILES" | grep -c . || echo "0")

echo -e "${BLUE}Files Changed ($FILE_COUNT):${NC}"
echo "$CHANGED_FILES" | head -10 | sed 's/^/   /'
if [ "$FILE_COUNT" -gt 10 ]; then
    echo "   ... and $((FILE_COUNT - 10)) more files"
fi
echo ""

# Check for common issues
echo -e "${BLUE}📋 Pre-Review Checks:${NC}"

# 1. Check for secrets
echo -n "   Checking for secrets... "
if git show "$TARGET" 2>/dev/null | grep -qE "(password|secret|key|token|apiKey)=" 2>/dev/null; then
    echo -e "${RED}⚠ Potential secrets detected${NC}"
else
    echo -e "${GREEN}✓ No obvious secrets${NC}"
fi

# 2. Check for large files
echo -n "   Checking file sizes... "
if [ "$TOTAL_CHANGES" -gt 1000 ]; then
    echo -e "${YELLOW}⚠ Large changeset (>1000 lines)${NC}"
else
    echo -e "${GREEN}✓ Reasonable file sizes${NC}"
fi

# 3. Check for test coverage
echo -n "   Checking for tests... "
if echo "$CHANGED_FILES" | grep -qE "\.test\.|\.spec\.|__test__"; then
    echo -e "${GREEN}✓ Tests included${NC}"
else
    echo -e "${YELLOW}⚠ No test files detected${NC}"
fi

# 4. Check for documentation
echo -n "   Checking for documentation... "
if echo "$CHANGED_FILES" | grep -qE "\.md$|README|CHANGELOG|docs/"; then
    echo -e "${GREEN}✓ Documentation updated${NC}"
else
    echo -e "${YELLOW}⚠ No documentation changes${NC}"
fi

echo ""
echo -e "${BLUE}🔎 Detailed Code Analysis:${NC}"

# TypeScript/JavaScript checks
if echo "$CHANGED_FILES" | grep -qE "\.(ts|tsx|js|jsx)$"; then
    echo "   TypeScript/JavaScript files detected"
    echo -n "     - Checking linting... "
    if npm run lint > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Lint passed${NC}"
    else
        LINT_ERRORS=$(npm run lint 2>&1 | grep -c "error" || echo "0")
        echo -e "${YELLOW}⚠ Found linting issues${NC}"
    fi
fi

echo ""
echo -e "${GREEN}✅ Code Review Analysis Complete${NC}"
echo ""
echo -e "${BLUE}📝 Next Steps:${NC}"
echo "   1. Review diff: git show $COMMIT_SHA"
echo "   2. Run full test suite: npm test"
echo "   3. Verify build: npm run build"
echo "   4. Create PR for final review"
echo ""

exit 0
