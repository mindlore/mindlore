'use strict';

const globals = require('globals');
const tseslint = require('@typescript-eslint/eslint-plugin');
const tsparser = require('@typescript-eslint/parser');

const sharedRules = {
  'no-console': 'off',
  'prefer-const': 'error',
  'no-var': 'error',
  eqeqeq: ['error', 'always'],
  curly: ['error', 'multi-line'],
};

module.exports = [
  {
    files: ['**/*.cjs'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: {
        ...globals.node,
        ...globals.commonjs,
        ...globals.jest,
      },
    },
    rules: {
      ...sharedRules,
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['**/*.ts'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      parser: tsparser,
      parserOptions: {
        project: './tsconfig.json',
      },
      globals: {
        ...globals.node,
        ...globals.jest,
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
    },
    rules: {
      ...sharedRules,
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-non-null-assertion': 'warn',
    },
  },
  {
    files: ['tests/**/*.ts'],
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },
];
