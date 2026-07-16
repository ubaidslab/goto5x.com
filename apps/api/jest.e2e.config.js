/** E2E tests - require real Postgres + Redis (see README "Running tests"). */
module.exports = {
  moduleFileExtensions: ["js", "json", "ts"],
  rootDir: ".",
  roots: ["<rootDir>/test/e2e"],
  setupFiles: ["<rootDir>/test/jest.e2e.setup.ts"],
  testRegex: ".*\\.e2e-spec\\.ts$",
  transform: {
    "^.+\\.(t|j)s$": "ts-jest",
  },
  testEnvironment: "node",
  testTimeout: 30000,
};
