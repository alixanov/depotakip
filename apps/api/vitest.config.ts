import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: false,
    include: ["tests/**/*.test.ts"],
    setupFiles: ["./tests/setup.ts"],
    testTimeout: 30000,
    hookTimeout: 90000,
    pool: "forks",
    poolOptions: { forks: { singleFork: true } },
    env: {
      NODE_ENV: "test",
      JWT_ACCESS_SECRET: "test-access-secret-must-be-at-least-32-chars-zzz",
      JWT_REFRESH_SECRET: "test-refresh-secret-must-be-at-least-32-chars-zzz",
      MONGODB_URI: "mongodb://placeholder",
      WEB_BASE_URL: "http://localhost:3000",
      LOG_LEVEL: "silent",
    },
  },
});
