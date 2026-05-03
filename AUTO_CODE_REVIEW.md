# Automatic Code Review Agent

Automated code review system for VibeScan that triggers when commits have 200-300 lines of changes.

## Architecture

### 1. **Local Git Hook** (`post-commit`)
- **When:** Automatically after each commit
- **What:** Triggers review if changes >= 200 lines
- **Output:** Detailed analysis with recommendations
- **Runtime:** ~2-5 seconds

### 2. **GitHub Actions** (`.github/workflows/auto-code-review.yml`)
- **When:** On every pull request
- **What:** Calculates changes, runs quality checks, posts review comment
- **Output:** Comment on PR with checklist
- **Runtime:** ~30-60 seconds

### 3. **Manual Script** (`scripts/auto-code-review.sh`)
- **When:** Run manually on-demand
- **What:** Complete code analysis with detailed breakdown
- **Output:** Full report with actionable recommendations
- **Runtime:** Depends on checks

---

## Setup

### Install Local Hook

```bash
# Already installed in .git/hooks/post-commit
# Verify it's executable:
ls -la .git/hooks/post-commit

# Test the hook manually:
./scripts/auto-code-review.sh HEAD
```

### GitHub Actions

The workflow automatically runs on all PRs. No additional setup needed.

---

## How It Works

### Change Detection

```
Commit Size Check
├── < 200 lines → SKIP (manual review only)
├── 200-300 lines → FULL REVIEW (ideal)
└── > 300 lines → WARN (split into smaller PRs)
```

### Analysis Performed

1. **Security Checks**
   - Detects potential secrets (passwords, API keys, tokens)
   - Checks for sensitive data exposure

2. **Code Quality**
   - Runs linting (ESLint, Prettier)
   - TypeScript type checking
   - Syntax validation

3. **Coverage**
   - Checks for test files included
   - Verifies documentation updates
   - Looks for changelog entries

4. **Size Analysis**
   - File change breakdown
   - Large file detection
   - Impact assessment

---

## Usage

### Automatic (After Commit)

```bash
# Make a commit with 200+ lines of changes
git commit -m "feat: large feature"

# Post-commit hook automatically runs:
# 🤖 AUTOMATIC CODE REVIEW AGENT - VIBESCAN
# 📊 Change Analysis: ~250 lines
# 🔍 Code Review Triggered!
```

### Manual Trigger

```bash
# Review a specific commit
./scripts/auto-code-review.sh HEAD

# Review a range
./scripts/auto-code-review.sh main~1..main

# Review a branch
./scripts/auto-code-review.sh feature-branch
```

### GitHub PR Comment

When a PR with 200+ lines is opened:
1. Workflow calculates changes
2. Posts comment with review checklist
3. Provides recommendations
4. Flags potential issues

---

## Configuration

### Change Thresholds

Edit these values in `scripts/auto-code-review.sh`:

```bash
MIN_LINES=200        # Minimum to trigger review
MAX_LINES=300        # Recommend splitting if exceeded
```

Edit workflow thresholds in `.github/workflows/auto-code-review.yml`:

```yaml
MIN_LINES: 200
MAX_LINES: 300
```

### Disabled Extensions

To skip review for specific files, add to `scripts/auto-code-review.sh`:

```bash
# Skip markdown-only commits
if [ "$FILE_COUNT" -eq 1 ] && echo "$CHANGED_FILES" | grep -q "\.md$"; then
    exit 0
fi
```

---

## Review Output

### Local Hook Example

```
╔════════════════════════════════════════════════════════════════════════════════╗
║             🤖 AUTOMATIC CODE REVIEW AGENT - VIBESCAN                        ║
╚════════════════════════════════════════════════════════════════════════════════╝

📊 Change Analysis:
   Target: HEAD
   Total changes: ~245 lines
   Threshold: 200 lines minimum

🔍 Code Review Triggered!
   Running comprehensive code analysis...

Commit Information:
   SHA: 937c39d
   Author: virusa78
   Message: fix: resolve Wasp build TypeScript errors

Files Changed (14):
   wasp-app/src/server/utils/webhookEncryption.ts
   wasp-app/src/server/operations/webhooks/createWebhook.ts
   wasp-app/main.wasp
   ... and 11 more files

📋 Pre-Review Checks:
   Checking for secrets... ✓ No obvious secrets
   Checking file sizes... ✓ No unusually large files
   Checking for tests... ✓ Tests included
   Checking for documentation... ✓ Documentation updated

🔎 Detailed Code Analysis:
   TypeScript/JavaScript files detected:
     - Checking linting... ✓ Lint passed
     - Checking types... ✓ TypeScript clean

✅ Code Review Analysis Complete

📝 Recommendations:
   1. Review diff: git show 937c39d
   2. Check test results in CI/CD
   3. Verify security scanning passed
```

### GitHub PR Comment Example

```
## 🤖 Automatic Code Review

**Changes:** 245 lines

✅ **Status:** Changes in ideal review range (200-300 lines)

### Pre-Review Checks
- [ ] Linting passed
- [ ] Types checked
- [ ] Tests included
- [ ] Documentation updated
- [ ] No secrets exposed
```

---

## Integration with CI/CD

### Recommended PR Workflow

1. **Developer** makes changes (200+ lines)
2. **Post-commit hook** runs automatically
3. **Developer** reviews findings locally
4. **Developer** pushes to GitHub
5. **GitHub Actions** runs additional checks
6. **PR comment** appears with review status
7. **Code reviewer** uses checklist to verify
8. **Approval** and merge

### Branch Protection

Recommended GitHub settings:

```
Branch Protection Rules (main):
✓ Require status checks to pass
  ✓ auto-code-review (required)
  ✓ tests (required)
  ✓ linting (required)
✓ Require code reviews (1 minimum)
✓ Require review before merge
```

---

## Customization

### Add Custom Checks

Edit `scripts/auto-code-review.sh` to add:

```bash
# Custom check example
echo -n "   Checking API contracts... "
if git show "$TARGET" | grep -q "breaking-api-change"; then
    echo -e "${RED}⚠ Breaking API change detected${NC}"
else
    echo -e "${GREEN}✓ API compatible${NC}"
fi
```

### Skip for Specific Commits

Add a git trailer to skip auto-review:

```bash
git commit -m "chore: version bump" -m "Skip-Review: trivial"
```

Then add check in hook:

```bash
if git log -1 --format=%B | grep -q "Skip-Review"; then
    exit 0
fi
```

---

## Troubleshooting

### Hook not running

```bash
# Check hook is executable
chmod +x .git/hooks/post-commit

# Test manually
./scripts/auto-code-review.sh HEAD

# Verify hook path
cat .git/hooks/post-commit | head -1
```

### False positives on secrets

Edit `scripts/auto-code-review.sh`:

```bash
# Update regex patterns
if git show "$TARGET" | grep -qE "(password|secret|key|token|apiKey)" 2>/dev/null; then
```

### GitHub Actions not triggering

```bash
# Check workflow file syntax
npx yamllint .github/workflows/auto-code-review.yml

# Verify permissions in workflow
permissions:
  pull-requests: write  # Required for commenting
```

---

## Best Practices

### ✅ Do

- **Split large changes** into 200-300 line chunks
- **Include tests** with your changes
- **Update documentation** in the same commit
- **Write clear commit messages** with context
- **Address review findings** before approval

### ❌ Don't

- **Commit secrets** (API keys, passwords, tokens)
- **Skip code review** even for small changes
- **Ignore linting failures** in CI
- **Large refactors** without tests
- **Breaking changes** without communication

---

## Metrics

### Typical Review Times

- **Local hook:** 2-5 seconds
- **GitHub Actions:** 30-60 seconds
- **Total feedback:** ~1-2 minutes

### Automation Coverage

- ✅ Security scanning: 100%
- ✅ Linting: 100%
- ✅ Type checking: 100%
- ✅ Size analysis: 100%
- ⚠️ Logic review: 0% (manual only)
- ⚠️ Architecture review: 0% (manual only)

---

## References

- GitHub Actions: https://docs.github.com/en/actions
- Git Hooks: https://git-scm.com/book/en/v2/Customizing-Git-Git-Hooks
- VibeScan Architecture: See CLAUDE.md
- Testing: npm test

---

**Last Updated:** April 17, 2026
**Status:** Production Ready
**Maintenance:** Low (auto-runs)
