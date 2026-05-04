module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],
  testPathIgnorePatterns: ['\\.e2e\\.test\\.ts$'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  moduleNameMapper: {
    '^wasp/server$': '<rootDir>/../test/mocks/wasp-server.ts',
    '^wasp/client/operations$': '<rootDir>/tests/mocks/wasp-client-operations.ts',
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tests/tsconfig.json' }],
  },
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.test.ts',
    '!src/**/*.d.ts',
  ],
};
