const request = require("supertest");
const app = require("../../app");

let counter = 0;

// Throwaway credentials generated per test run; never real accounts.
function testCredentials(overrides = {}) {
  counter += 1;
  return {
    username: `tester${counter}`,
    email: `tester${counter}.${Date.now()}@example.test`,
    password: `pw-${counter}-${Math.random().toString(36).slice(2, 10)}`,
    ...overrides,
  };
}

/**
 * Signs up a user through the real API and returns a Supertest agent that
 * carries the resulting jwt cookie, plus the new user's id.
 */
async function signedInAgent(overrides) {
  const agent = request.agent(app);
  const credentials = testCredentials(overrides);
  const res = await agent.post("/api/signup").send(credentials);
  if (res.status !== 200) {
    throw new Error(`Test signup failed with status ${res.status}`);
  }
  return { agent, userId: res.body.user, credentials };
}

const validMonitor = (overrides = {}) => ({
  name: "Example API",
  url: "https://example.com/health",
  method: "GET",
  interval: 60,
  expectedStatusCode: 200,
  ...overrides,
});

module.exports = { app, request, testCredentials, signedInAgent, validMonitor };
