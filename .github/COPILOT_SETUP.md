# MCP & Cloud Agent Configuration for VibeScan

This document describes the Model Context Protocol (MCP) and GitHub Copilot cloud agent configuration for the VibeScan project.

## GitHub Copilot Cloud Agent Setup

A `copilot-setup-steps.yml` workflow has been configured to prepare Copilot's ephemeral development environment. This ensures the agent has all required tools pre-installed before starting work on the repository.

### File Location
```
.github/workflows/copilot-setup-steps.yml
```

### What Gets Pre-Installed

1. **Node.js 24.14.1 LTS** - With npm dependency caching
2. **Wasp CLI** - Latest version via official installer
3. **Root dependencies** - npm ci from package.json
4. **Wasp-app dependencies** - Full dependency tree for main application
5. **PostgreSQL** - For database operations and testing
6. **Playwright** - Chromium browser with dependencies for E2E testing
7. **Build tools** - Docker buildx for containerization

### Verification Steps

The workflow verifies all critical tools:
- Node.js, npm versions
- Wasp CLI version
- TypeScript compiler
- ESLint
- Jest test runner
- Playwright

### Type Checking & Linting

The workflow runs:
- `npm run lint` - ESLint checks (non-blocking, continues on error)
- `npx tsc --noEmit` - TypeScript verification (non-blocking)
- `wasp build` - Full build verification (non-blocking)
- Database initialization for Prisma (non-blocking)

All checks continue on error to ensure Copilot still has a working environment even if some checks fail.

### Trigger Conditions

The workflow automatically runs when:
1. `copilot-setup-steps.yml` is modified (for validation)
2. PR changes to the workflow file
3. Manual trigger via GitHub Actions UI

The workflow will NOT automatically run on all commits—it only runs when explicitly triggered or when the file changes. This is intentional to save compute resources.

## Usage for Copilot Sessions

When Copilot starts a task in this repository:

1. ✅ All dependencies are already installed
2. ✅ Wasp CLI is available at `~/.wasp/bin/wasp`
3. ✅ PostgreSQL test database is ready
4. ✅ Playwright browsers are cached and ready
5. ✅ TypeScript is pre-compiled and verified

Copilot can immediately:
- Build the project: `cd wasp-app && wasp build`
- Run tests: `npm test`, `npm run test:e2e`
- Run linting: `npm run lint`
- Start development: `./run.sh`

## Environment Variables in Copilot

To set sensitive environment variables (API keys, secrets) for Copilot's use:

1. Go to **Settings → Environments** in your GitHub repository
2. Click on the **`copilot`** environment
3. Add "Environment secrets" for sensitive values
4. Add "Environment variables" for non-sensitive configuration

Example secrets you might want to add:
- `AWS_ACCESS_KEY_ID` - For S3 operations
- `AWS_SECRET_ACCESS_KEY` - For S3 operations
- `STRIPE_SECRET_KEY` - For billing operations
- `GITHUB_APP_PRIVATE_KEY` - For GitHub App integration

These will be automatically available in Copilot's environment when it runs.

## Current Configuration Status

✅ **Configured:**
- Node.js 24.14.1 LTS
- Wasp 0.23+ CLI
- All npm dependencies (root + wasp-app)
- PostgreSQL (test DB ready)
- Playwright with Chromium
- TypeScript toolchain
- ESLint & Prettier (if configured)
- Jest test runner

⚠️ **Optional Enhancements:**

If you need Copilot to run containerized scans:
- Add Docker service setup to `services:` section of workflow
- Add MinIO (S3-compatible storage) for local testing
- Add Redis for cache testing

If you need self-hosted runners:
- Change `runs-on: ubuntu-latest` to your ARC scale set name
- Configure firewall rules for outbound HTTPS access

## Debugging Cloud Agent Setup

To test the setup workflow locally:

1. **Manually trigger the workflow:**
   - Go to GitHub Actions → "Copilot Setup Steps"
   - Click "Run workflow" → select your branch

2. **View the logs:**
   - Watch the workflow output in real-time
   - Check the "Verify toolchain" step for versions
   - Check "Display setup summary" for final status

3. **Common issues:**
   - **Wasp CLI timeout:** Increase `timeout-minutes` in the workflow
   - **PostgreSQL not starting:** Add explicit service configuration
   - **Playwright install fails:** Already handled with `--with-deps`

## Integration with `.github/copilot-instructions.md`

The copilot-instructions.md file provides high-level guidance on:
- Build and test commands
- Architecture overview
- Code conventions
- Key patterns and invariants

The `copilot-setup-steps.yml` workflow ensures the *environment* has everything needed to execute those commands.

Together, they create a complete setup for Copilot to work effectively in VibeScan.

## Future Considerations

1. **MCP Servers** - Protocol servers can be configured separately for enhanced capabilities
2. **Larger runners** - If builds become slow, upgrade from `ubuntu-latest` to `ubuntu-4-core`
3. **Private networking** - If using Azure private networking, configure IP allowlist
4. **Windows support** - Can be added if Windows-specific tooling is needed

---

**Last Updated:** May 2, 2026  
**Wasp Version:** 0.23+  
**Node.js:** 24.14.1 LTS  
**Status:** ✅ Production Ready
