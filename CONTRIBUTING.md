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

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode (development)
npm run test:watch
```

### Test Coverage

The project includes:
- **Property-based tests** (20 properties) in `test/unit/property-tests.test.ts`
- **Integration tests** in `test/integration/integration-tests.test.ts`

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
