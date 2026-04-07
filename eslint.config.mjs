/**
 * ESLint configuration for VibeScan
 * Uses Flat config format for ESLint v9+
 */

import typescriptEslint from '@typescript-eslint/eslint-plugin';
import parser from '@typescript-eslint/parser';

export default [
    {
        ignores: ['node_modules/', 'dist/', '.data/', 'coverage/', 'vibescan-ui/'],
    },
    {
        files: ['**/*.ts', '**/*.tsx'],
        languageOptions: {
            parser: parser,
            parserOptions: {
                ecmaVersion: 2022,
                sourceType: 'module',
                project: true,
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
