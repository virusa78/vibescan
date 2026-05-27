/**
 * Jest configuration for VibeScan (Wasp-only)
 * Uses CommonJS format for Jest config
 */

import { execSync } from 'child_process';

const coverageGateMode = process.env.COVERAGE_GATE_MODE ?? 'staged';
const coverageGates = {
    staged: { lines: 6, branches: 3 },
    strict: { lines: 70, branches: 70 },
};
const selectedCoverageGate = coverageGates[coverageGateMode] ?? coverageGates.staged;

const ignorePatterns = [
    '/node_modules/',
    '/dist/',
    '/.wasp/',
    '/\\.tmp-wasp/',
    '/vibescan-master-base/',
    '/test/e2e-wasp/',
    '/Backup/',
];

// Check if database is configured and running
let hasDatabase = false;
if (process.env.ANTIGRAVITY_AGENT === '1') {
    hasDatabase = false;
} else if (process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('localhost') && !process.env.DATABASE_URL.includes('127.0.0.1') && !process.env.DATABASE_URL.includes('localhost:5444')) {
    hasDatabase = true;
} else {
    try {
        // Quick check if ports 5432 or 5444 are listening on localhost
        execSync('ss -tlnp | grep -E ":5432|:5444" || lsof -i :5432 -sTCP:LISTEN -t || lsof -i :5444 -sTCP:LISTEN -t', { stdio: 'ignore' });
        hasDatabase = true;
    } catch (e) {
        // no active local listener detected
    }
}

if (!hasDatabase) {
    console.log('\n[Jest Config] Ignoring integration and e2e tests.\n');
    ignorePatterns.push('/test/integration/');
    ignorePatterns.push('\\.e2e\\.test\\.ts$');
}

/** @type {import('jest').Config} */
const config = {
    testEnvironment: 'node',
    testPathIgnorePatterns: ignorePatterns,
    // For Wasp projects, run tests via wasp test command
    // This config is kept for reference but not actively used
    globals: {
        'ts-jest': {
            tsconfig: 'tsconfig.test.json',
            diagnostics: {
                warnOnly: true
            },
            isolatedModules: true
        }
    },
    transform: {
        '^.+\\.ts$': ['ts-jest', { tsconfig: 'tsconfig.test.json', useESM: false, isolatedModules: true }]
    },
    transformIgnorePatterns: ['node_modules/(?!bullmq)'],
    moduleFileExtensions: ['js', 'ts', 'json'],
    moduleDirectories: ['node_modules', '<rootDir>/wasp-app/node_modules'],
    modulePathIgnorePatterns: ['<rootDir>/wasp-app/.wasp/out', 'node_modules/.*\\.ts$'],
    moduleNameMapper: {
        '^(\\.{1,2}/.*)\\.js$': '$1',
        '^@prisma/client$': '<rootDir>/wasp-app/node_modules/@prisma/client',
        '^wasp/server$': '<rootDir>/test/mocks/wasp-server.ts',
        '^vitest$': '<rootDir>/test/vitest-shim.js',
        '^\.\./wasp-app/(.*)$': '<rootDir>/wasp-app/$1',
        '^yaml$': '<rootDir>/node_modules/yaml',
        '^.+\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    },

    verbose: true,
    testTimeout: 30000,
};

console.log('Resolved testPathIgnorePatterns:', config.testPathIgnorePatterns);

export default config;
