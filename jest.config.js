/** @type {import('jest').Config} */
const config = {
  testEnvironment: 'node',
  roots: ['<rootDir>/__tests__'],
  testMatch: ['**/*.test.ts'],
  clearMocks: true,
  resetMocks: false,
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'lib/**/*.ts',
    'api/**/*.ts',
    '!lib/supabase.ts',
    '!lib/sentry.ts',
    '!lib/database.types.ts',
  ],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: 'tsconfig.json',
      diagnostics: false,
    }],
  },
};

module.exports = config;
