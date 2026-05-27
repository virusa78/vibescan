/**
 * ESLint configuration for VibeScan
 * Uses Flat config format for ESLint v9+
 */

import typescriptEslint from '@typescript-eslint/eslint-plugin';
import parser from '@typescript-eslint/parser';

export default [
    {
        ignores: [
            'node_modules/',
            'node_modules/**',
            'dist/',
            'dist/**',
            '.data/',
            '.data/**',
            'coverage/',
            'coverage/**',
            'vibescan-ui/',
            'vibescan-ui/**',
            'backup/',
            'backup/**',
            'Backup/',
            'Backup/**',
            'wasp-app/.wasp/',
            'wasp-app/.wasp/**',
            'playwright-report/',
            'playwright-report/**',
            'test-results/',
            'test-results/**',
            'scratch/',
            'scratch/**',
            '**/node_modules/**',
            '**/dist/**',
            '**/coverage/**',
            '**/.wasp/**',
            '**/scratch/**',
        ],
    },
    {
        files: ['**/*.ts', '**/*.tsx'],
        languageOptions: {
            parser: parser,
            parserOptions: {
                ecmaVersion: 2022,
                sourceType: 'module',
                project: [
                    './tsconfig.json',
                    './tsconfig.test.json',
                    './tsconfig.deployment-scripts.json',
                    './wasp-app/tsconfig.json',
                    './wasp-app/tsconfig.eslint.json',
                ],
            },
        },
        plugins: {
            '@typescript-eslint': typescriptEslint,
        },
        rules: {
            ...typescriptEslint.configs.recommended.rules,
            '@typescript-eslint/no-explicit-any': 'warn',
            '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
            '@typescript-eslint/no-var-requires': 'off',
            '@typescript-eslint/no-require-imports': 'off',
            'no-console': 'off',
            'no-debugger': 'warn',
            'no-empty': ['warn', { allowEmptyCatch: true }],
        },
    },
];
