# Contributing to VibeScan

## Development Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start Docker services:
   ```bash
   docker compose up -d
   ```

3. Run migrations:
   ```bash
   npm run migrate
   ```

4. Start development server:
   ```bash
   npm run dev
   ```

## Testing

All tests must pass before committing:

```bash
# Run all tests
npm test

# Coverage report only (no gate)
npm run test:coverage

# Enforced staged gate (current baseline)
npm run test:coverage:gate

# Enforced strict target gate (70/70)
npm run test:coverage:strict

# Run tests in watch mode (development)
npm run test:watch
```

### Test Coverage

The project includes:
- **Property-based tests** (20 properties) in `test/unit/property-tests.test.ts`
- **Integration tests** in `test/integration/integration-tests.test.ts`

Coverage gate policy:
- `test:coverage:gate` enforces current staged minimums (`lines >= 6`, `branches >= 3`)
- `test:coverage:strict` enforces the target (`lines >= 70`, `branches >= 70`)
- Use `test:coverage` for local coverage reporting without thresholds

### E2E Tests

Before running E2E tests, ensure API and frontend are running and reachable:

```bash
docker compose up -d
npm run migrate
cd vibescan-ui && npm run dev
```

Then run:
```bash
npm run test:e2e
```

`test:e2e` performs a preflight check and exits early with an actionable message if `API_URL` (`/health`) or `FRONTEND_URL` (`/login`) is unavailable.

Run the test script after major changes:
```bash
./scripts/run-tests.sh
```

## Linting

```bash
# Run linting
npm run lint

# Auto-fix linting issues
npm run lint:fix
```

## CI/CD Pipeline

The CI/CD pipeline automatically runs:
1. Linting checks
2. Unit tests with coverage
3. TypeScript compilation
4. Docker image build
5. Kubernetes deployment

## Code Style

- TypeScript with ES modules
- Follow existing code patterns
- Add tests for new features
- Run linting before committing
