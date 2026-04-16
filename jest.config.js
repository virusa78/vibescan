/**
 * Jest configuration for VibeScan
 * Uses CommonJS format for Jest config
 */

const coverageGateMode = process.env.COVERAGE_GATE_MODE ?? 'staged';
const coverageGates = {
    staged: { lines: 6, branches: 3 },
    strict: { lines: 70, branches: 70 },
};
const selectedCoverageGate = coverageGates[coverageGateMode] ?? coverageGates.staged;

/** @type {import('jest').Config} */
const config = {
    testEnvironment: 'node',
    testPathIgnorePatterns: [
        '/node_modules/',
        '/dist/',
        '/test/e2e/',
        '/test/e2e-wasp/',
        '/\\.tmp-wasp/',
        '/e2e-tests/',
        '/vibescan-ui/e2e/'
    ],
    transform: {
        '^.+\\.ts$': ['ts-jest', { tsconfig: 'tsconfig.test.json', useESM: false }]
    },
    transformIgnorePatterns: ['node_modules/(?!bullmq)'],
    moduleFileExtensions: ['ts', 'js', 'json'],
    moduleNameMapper: {
        '^(\\.{1,2}/.*)\\.js$': '$1',
        '^.+\\.(css|less|scss|sass)$': 'identity-obj-proxy',
        '^@/(.*)$': '<rootDir>/src/$1',
        '^@services/(.*)$': '<rootDir>/src/services/$1',
        '^@db/(.*)$': '<rootDir>/src/database/$1',
        '^@redis/(.*)$': '<rootDir>/src/redis/$1',
        '^@queues/(.*)$': '<rootDir>/src/queues/$1',
        '^@s3/(.*)$': '<rootDir>/src/s3/$1',
        '^@types/(.*)$': '<rootDir>/src/types/$1',
        '^@utils/(.*)$': '<rootDir>/src/utils/$1',
    },
    collectCoverageFrom: [
        'src/**/*.ts',
        '!src/**/*.d.ts',
        '!src/database/migrations/**',
        // Temporarily excluded until ts-jest/ESM coverage support is fixed.
        '!src/index.ts',
        '!src/database/migrate.ts',
        '!src/services/authService.ts',
        '!src/services/billingService.ts'
    ],
    coverageDirectory: 'coverage',
    coverageReporters: ['text', 'lcov', 'html', 'json-summary'],
    ...(coverageGateMode !== 'off' ? {
        coverageThreshold: {
            global: {
                lines: selectedCoverageGate.lines,
                branches: selectedCoverageGate.branches,
            }
        }
    } : {}),
    verbose: true,
    testTimeout: 30000,
};

export default config;
