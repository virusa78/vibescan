/**
 * Jest configuration for VibeScan (Wasp-only)
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
        '/.wasp/',
        '/\\.tmp-wasp/',
    ],
    // For Wasp projects, run tests via wasp test command
    // This config is kept for reference but not actively used
    transform: {
        '^.+\\.ts$': ['ts-jest', { tsconfig: 'tsconfig.test.json', useESM: false }]
    },
    transformIgnorePatterns: ['node_modules/(?!bullmq)'],
    moduleFileExtensions: ['ts', 'js', 'json'],
    moduleNameMapper: {
        '^(\\.{1,2}/.*)\\.js$': '$1',
        '^wasp/server$': '<rootDir>/test/mocks/wasp-server.ts',
        '^.+\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    },
    verbose: true,
    testTimeout: 30000,
};

export default config;
