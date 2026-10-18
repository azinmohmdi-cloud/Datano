import { defineConfig } from "@playwright/test";

if (!process.env.DATANO_TRANSPORT_API_URL) {
  throw new Error("DATANO_TRANSPORT_API_URL must point to a dedicated, running test backend");
}

export default defineConfig({
  testDir: "./tests/transport",
  testMatch: "browser.spec.ts",
  workers: 1,
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  timeout: 30_000,
  reporter: "list",
  outputDir: "test-results/transport-integration",
  use: { baseURL: "http://127.0.0.1:3139", browserName: "chromium",
    channel: process.env.PLAYWRIGHT_CHANNEL || undefined, trace: "off" },
  webServer: {
    command: "node tests/transport/serve-browser-harness.mjs",
    url: "http://127.0.0.1:3139",
    reuseExistingServer: false,
    timeout: 90_000,
  },
});
