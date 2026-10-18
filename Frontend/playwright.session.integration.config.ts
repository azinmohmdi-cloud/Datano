import { defineConfig } from "@playwright/test";
const api = process.env.DATANO_SESSION_API_URL;
if (!api) throw new Error("Dedicated FE-030 integration backend is required");
export default defineConfig({
  testDir: "./tests/session", testMatch: "product.browser.spec.ts", workers: 1, retries: 0, forbidOnly: true,
  timeout: 30_000, reporter: "list", outputDir: "test-results/session-integration",
  use: { baseURL: "http://127.0.0.1:3100", channel: process.env.PLAYWRIGHT_CHANNEL, trace: "off", locale: "fa-IR" },
  projects: [{ name: "mobile", use: { viewport: { width: 390, height: 844 } } }, { name: "desktop", use: { viewport: { width: 1440, height: 900 } } }],
  webServer: { command: "pnpm dev --hostname 127.0.0.1 --port 3100", url: "http://127.0.0.1:3100/login", reuseExistingServer: false,
    timeout: 120_000, env: { NEXT_PUBLIC_API_URL_V1: api, UI_REVIEW_ENABLED: "0" } },
});
