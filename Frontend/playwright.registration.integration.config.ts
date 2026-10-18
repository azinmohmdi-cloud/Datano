import { defineConfig } from "@playwright/test";
if (!process.env.DATANO_TRANSPORT_API_URL) throw new Error("Dedicated integration backend URL is required");
export default defineConfig({
  testDir: "./tests/session", testMatch: "registration.browser.spec.ts", workers: 1, retries: 0, forbidOnly: true,
  timeout: 30_000, reporter: "list", outputDir: "test-results/registration-integration",
  use: { baseURL: "http://127.0.0.1:3139", channel: process.env.PLAYWRIGHT_CHANNEL, trace: "off" },
  webServer: { command: "node tests/transport/serve-browser-harness.mjs", url: "http://127.0.0.1:3139",
    reuseExistingServer: false, timeout: 120_000, env: { DATANO_TEST_REGISTRATION: "1", DATANO_TRANSPORT_SAME_ORIGIN: "1" } },
});
