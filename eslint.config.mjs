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
            'dist/',
            '.data/',
            'coverage/',
            'vibescan-ui/',
            'backup/',
            'wasp-app/.wasp/',
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
            'no-console': 'off',
            'no-debugger': 'warn',
            'no-empty': ['warn', { allowEmptyCatch: true }],
        },
    },
];
