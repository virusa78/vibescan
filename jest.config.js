/**
 * Jest configuration for VibeScan
 * Uses CommonJS format for Jest config
 */

/** @type {import('jest').Config} */
const config = {
    testEnvironment: 'node',
    testPathIgnorePatterns: ['/node_modules/', '/dist/', '/e2e/'],
    transform: {
        '^.+\\.ts$': ['ts-jest', { tsconfig: 'tsconfig.test.json', useESM: false }]
    },
    transformIgnorePatterns: ['node_modules/(?!bullmq)'],
    moduleFileExtensions: ['ts', 'js', 'json'],
    moduleNameMapper: {
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
        '!src/database/migrations/**'
    ],
    coverageDirectory: 'coverage',
    coverageReporters: ['text', 'lcov', 'html'],
    verbose: true,
    testTimeout: 30000,
};

export default config;
