/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-preset-angular',
  setupFilesAfterEnv: ['<rootDir>/setup-jest.ts'],
  testPathIgnorePatterns: ['/node_modules/', '/cypress/', '/dist/'],
  collectCoverageFrom: ['src/app/**/*.ts', '!src/app/**/*.routes.ts'],
  coverageDirectory: 'coverage',
};
