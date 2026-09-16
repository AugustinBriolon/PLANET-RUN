import { defineConfig, devices } from "@playwright/test";

const port = 3100;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  use: {
    baseURL: `http://localhost:${port}`,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    // Production build: closer to reality, and does not clash with a running `next dev`.
    command: `pnpm build && pnpm start --port ${port}`,
    url: `http://localhost:${port}/login`,
    // Production Auth.js only accepts declared hosts; the local test server is trusted explicitly.
    env: { AUTH_TRUST_HOST: "true" },
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
  },
});
