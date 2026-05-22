Summary of automated improvements performed on behalf of the reviewer:

- Added GitHub Actions CI workflow (.github/workflows/ci.yml) that runs:
  - npm ci
  - npm run lint
  - npm run openapi:contract
  - npm test
  - npm audit (moderate level)

- Ran npm audit and applied automatic fixes (npm audit fix --package-lock-only + npm audit fix). package-lock.json updated and committed.

- Fixed small ESLint issues in tests (removed unused imports) to reduce noise.

- Adjusted Jest configuration to ignore an auxiliary directory that caused module-name collisions in the test runner.

Next recommended steps (not yet completed):
1. Triage remaining ESLint warnings that require code changes (explicit `any` types, unused variables in other files).
2. Harden CI: fail on lint warnings (set max-warnings=0) after fixing warnings; enable coverage gate in CI.
3. Run full dependency updates (consider running `npm-check-updates` and manual verification for major bumps).
4. Enable Dependabot or Renovate for continuous dependency updates.
5. Address test runner flakiness and ensure all Jest suites run in CI (investigate why some suites report 0 tests).

If accepted, prepare a PR with these changes (branch: chore/ci-deps-lint) and open follow-up issues for the next steps.
