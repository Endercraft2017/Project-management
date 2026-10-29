// Maintained behavior tests only. Historical tests/feature contains shared-DB
// cleanup, obsolete route assumptions and placeholder assertions; it remains
// visible as legacy work and is not described as production validation.
module.exports = {
  ...require('./jest.config.js'),
  roots: ['<rootDir>/src'],
  testMatch: [
    '<rootDir>/src/auth/__tests__/*.test.ts',
    '<rootDir>/src/platform/__tests__/*.test.ts',
    '<rootDir>/src/export/__tests__/*.test.ts',
    '<rootDir>/src/tenancy/__tests__/*.test.ts',
    '<rootDir>/src/lib/__tests__/*.test.ts',
    '<rootDir>/src/invites/__tests__/controller.test.ts',
    '<rootDir>/src/invites/__tests__/service-boundary.test.ts',
    '<rootDir>/src/tasks/__tests__/read-authorization.test.ts',
    '<rootDir>/src/updates/__tests__/validators.test.ts',
    '<rootDir>/src/services/__tests__/openai.safety.test.ts',
    '<rootDir>/src/chat/__tests__/isolation.test.ts',
    '<rootDir>/src/upload/__tests__/isolation.test.ts',
  ],
  collectCoverage: false,
  // This suite is explicit about behavior coverage; legacy 80% whole-codebase
  // coverage thresholds cannot truthfully be applied to this focused suite.
  coverageThreshold: {},
};
