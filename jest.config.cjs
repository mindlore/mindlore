module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.ts'],
  testPathIgnorePatterns: ['/node_modules/', '/dist/'],
  verbose: true,
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: 'tsconfig.json' }],
  },
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  moduleFileExtensions: ['ts', 'js', 'cjs', 'json'],
};
