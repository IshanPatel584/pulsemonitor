/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: "node",
  testMatch: ["<rootDir>/tests/**/*.test.js"],
  setupFiles: ["<rootDir>/tests/setup-env.js"],
  // bcrypt hashing and MongoDB round-trips need a little more than Jest's 5s default.
  testTimeout: 20000,
  restoreMocks: true,
  clearMocks: true,
};
