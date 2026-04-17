# VibeScan Documentation Index

Complete guide to all documentation files for VibeScan Phase 5 (Production Ready).

## Quick Start

**For Developers**: Start with [CLAUDE.md](CLAUDE.md)  
**For Deployment**: Start with [PRODUCTION_CHECKLIST.md](PRODUCTION_CHECKLIST.md)  
**For API Integration**: Start with [OPERATIONS.md](OPERATIONS.md)  
**For Agents/Scripts**: Start with [AGENTS.md](AGENTS.md)

---

## Documentation Files

### Core Documentation

| File | Purpose | Audience | Length |
|------|---------|----------|--------|
| [CLAUDE.md](CLAUDE.md) | Developer guide to codebase | Developers, Claude Code | 22KB |
| [AGENTS.md](AGENTS.md) | Agent collaboration guide | AI agents, automation | 15KB |
| [OPERATIONS.md](OPERATIONS.md) | Complete API reference (20 ops) | Developers, integrators | 21KB |
| [PRODUCTION_CHECKLIST.md](PRODUCTION_CHECKLIST.md) | Pre-deployment verification | DevOps, release managers | 9KB |
| [PHASE_5_COMPLETION.md](PHASE_5_COMPLETION.md) | Phase 5 summary & status | Project managers | 11KB |

### Setup & Deployment

| File | Purpose | When to Use |
|------|---------|------------|
| [STARTUP.md](STARTUP.md) | Quick start (development) | Local development setup |
| [STARTUP_GUIDE.md](STARTUP_GUIDE.md) | Detailed setup guide | First-time setup |
| [README.md](README.md) | Project overview | New contributors |
| [CONTRIBUTING.md](CONTRIBUTING.md) | PR workflow & guidelines | Before submitting code |

### Phase Documentation

| File | Phase | Status |
|------|-------|--------|
| [PHASE_1_COMPLETION.md](PHASE_1_COMPLETION.md) | Phase 1 (Infrastructure) | ✅ Complete |
| [PHASE_2_SUMMARY.md](PHASE_2_SUMMARY.md) | Phase 2 (Auth & API) | ✅ Complete |
| [PHASE_2_WEBHOOK_OPERATIONS.md](PHASE_2_WEBHOOK_OPERATIONS.md) | Phase 2 (Webhooks) | ✅ Complete |
| [PHASE_3_DASHBOARD_COMPLETE.md](PHASE_3_DASHBOARD_COMPLETE.md) | Phase 3 (Dashboard) | ✅ Complete |
| [PHASE_3_SETTINGS_OPERATIONS.md](PHASE_3_SETTINGS_OPERATIONS.md) | Phase 3 (Settings) | ✅ Complete |
| [PHASE_3_VERIFICATION.md](PHASE_3_VERIFICATION.md) | Phase 3 (Verification) | ✅ Complete |
| [PHASE_5_COMPLETION.md](PHASE_5_COMPLETION.md) | Phase 5 (Documentation) | ✅ Complete |

### Reference Documentation

| File | Purpose |
|------|---------|
| [SCRIPTS_REFERENCE.md](SCRIPTS_REFERENCE.md) | All CLI commands |
| [DASHBOARD_OPERATIONS_README.md](DASHBOARD_OPERATIONS_README.md) | Dashboard operations reference |
| [DEMO_CREDENTIALS.md](DEMO_CREDENTIALS.md) | Demo account credentials |
| [VERIFICATION_RESULTS.md](VERIFICATION_RESULTS.md) | Phase verification results |

---

## Reading Paths by Role

### 👨‍💻 Backend Developer

1. Start: [CLAUDE.md](CLAUDE.md) - Architecture & tech stack
2. Learn: [OPERATIONS.md](OPERATIONS.md) - API operations
3. Code: Reference Wasp patterns in [CLAUDE.md](CLAUDE.md)
4. Test: Check testing sections
5. Deploy: Follow [PRODUCTION_CHECKLIST.md](PRODUCTION_CHECKLIST.md)

### 🎨 Frontend Developer

1. Start: [CLAUDE.md](CLAUDE.md) - Project structure
2. Learn: [OPERATIONS.md](OPERATIONS.md) - Available operations
3. Code: React components in `wasp-app/src/client/`
4. Style: Reference Tailwind patterns
5. Test: E2E tests in `test/e2e/`

### 🚀 DevOps / Deployment

1. Checklist: [PRODUCTION_CHECKLIST.md](PRODUCTION_CHECKLIST.md)
2. Setup: [STARTUP_GUIDE.md](STARTUP_GUIDE.md)
3. Scripts: [SCRIPTS_REFERENCE.md](SCRIPTS_REFERENCE.md)
4. Monitor: Review deployment procedures
5. Verify: Follow post-deployment monitoring

### 🤖 AI Agent / Automation

1. Guide: [AGENTS.md](AGENTS.md) - Agent-specific instructions
2. API: [OPERATIONS.md](OPERATIONS.md) - Operation details
3. Code: Pattern examples in [AGENTS.md](AGENTS.md)
4. Build: Review build commands
5. Deploy: Railway/Fly.io procedures

### 📚 Documentation / Content

1. Overview: [README.md](README.md)
2. Status: [PHASE_5_COMPLETION.md](PHASE_5_COMPLETION.md)
3. API Docs: [OPERATIONS.md](OPERATIONS.md)
4. Updates: Review all .md files

### 🔍 QA / Testing

1. Setup: [STARTUP.md](STARTUP.md)
2. Operations: [OPERATIONS.md](OPERATIONS.md)
3. Checklist: [PRODUCTION_CHECKLIST.md](PRODUCTION_CHECKLIST.md)
4. Tests: `test/` directory structure
5. Verification: [VERIFICATION_RESULTS.md](VERIFICATION_RESULTS.md)

---

## Key Information Quick Links

### Architecture
- **Framework**: Wasp 0.23+ (full-stack TypeScript)
- **Backend**: Node.js 24.14.1 LTS
- **Database**: PostgreSQL 15 + Prisma ORM
- **Frontend**: React + Vite + Tailwind CSS
- **See**: [CLAUDE.md - Tech Stack](CLAUDE.md#tech-stack)

### Operations (20 Total)
- **User Management**: 3 operations
- **API Keys**: 3 operations
- **Scans**: 3 operations
- **Reports**: 4 operations
- **Webhooks**: 5 operations
- **Billing**: 2 operations
- **See**: [OPERATIONS.md](OPERATIONS.md)

### Database (13 Tables)
- User, Auth, AuthIdentity, Session (Wasp managed)
- Scan, Finding, ScanResult, ScanDelta
- ApiKey, Webhook, WebhookDelivery
- FindingHistory, StripeCustomer (optional)
- **See**: [CLAUDE.md - Database Schema](CLAUDE.md#database-schema-13-tables)

### Deployment
- **Local**: `cd wasp-app && PORT=3555 wasp start`
- **Railway**: `wasp deploy railway`
- **Fly.io**: `wasp deploy fly`
- **See**: [PRODUCTION_CHECKLIST.md - Deployment Steps](PRODUCTION_CHECKLIST.md#deployment-steps)

### Security
- JWT authentication (15 min access, 30 day refresh)
- API key management (bcrypt hashing)
- Webhook HMAC signing (SHA256)
- Ownership verification in all operations
- **See**: [OPERATIONS.md - Error Codes](OPERATIONS.md#general-error-responses)

---

## Documentation Statistics

| Metric | Value |
|--------|-------|
| Total Documentation Lines | ~3,100 |
| Total Markdown Files | 20 |
| API Operations Documented | 20 |
| Database Tables Documented | 13 |
| Phase Completion Reports | 7 |
| Deployment Guides | 3 |
| Test Suites | 3 (unit, integration, E2E) |

---

## Keeping Documentation Updated

### When to Update Docs

1. **Adding a new operation**: Update [OPERATIONS.md](OPERATIONS.md)
2. **Changing database schema**: Update [CLAUDE.md](CLAUDE.md) database section
3. **New security feature**: Update [CLAUDE.md](CLAUDE.md) security section
4. **Deployment procedure change**: Update [PRODUCTION_CHECKLIST.md](PRODUCTION_CHECKLIST.md)
5. **Bug fixes**: Reference in commit message, not in docs

### Documentation Standards

- Use Markdown formatting
- Include code examples where relevant
- Keep examples up-to-date with actual code
- Include links to related documentation
- Mark deprecated sections clearly

---

## Search Tips

**Find operations by category**: See [OPERATIONS.md - Operations Summary](OPERATIONS.md#operations-summary)

**Find troubleshooting tips**: See [CLAUDE.md - Troubleshooting](CLAUDE.md#troubleshooting-common-issues)

**Find build commands**: See [CLAUDE.md - Build & Run Commands](CLAUDE.md#build--run-commands)

**Find security patterns**: See [CLAUDE.md - Code Patterns](CLAUDE.md#code-patterns-best-practices)

**Find deployment procedures**: See [PRODUCTION_CHECKLIST.md](PRODUCTION_CHECKLIST.md)

---

## Contact & Support

- **Bug Reports**: Create issue with reference to relevant documentation
- **Documentation Feedback**: Submit PR with improvements
- **Questions**: Check documentation first, then ask maintainers
- **Deployment Help**: Follow [PRODUCTION_CHECKLIST.md](PRODUCTION_CHECKLIST.md)

---

## Version Information

- **Wasp Version**: 0.23+
- **Node.js**: 24.14.1 LTS
- **TypeScript**: Latest
- **Prisma**: Latest
- **Last Updated**: April 17, 2026
- **Status**: 🟢 Production Ready

---

**Start Here**: 👉 [CLAUDE.md](CLAUDE.md) for developers, [PRODUCTION_CHECKLIST.md](PRODUCTION_CHECKLIST.md) for deployment

For a quick overview of all operations, see [OPERATIONS.md](OPERATIONS.md).
