import { defineConfig } from "@playwright/test";

const api = process.env.DATANO_RECOVERY_API_URL;
if (!api || !process.env.DATANO_RECOVERY_CAPTURE_MAILBOX) throw new Error("Set DATANO_RECOVERY_API_URL and a test-only DATANO_RECOVERY_CAPTURE_MAILBOX; never use a live mailbox.");
export default defineConfig({ testDir: "./tests/recovery", testMatch: "product.browser.spec.ts", workers: 1,
  fullyParallel: false, forbidOnly: true, retries: 0, timeout: 30_000, reporter: "list", outputDir: "test-results/recovery-integration",
  use: { baseURL: "http://127.0.0.1:3100", channel: process.env.PLAYWRIGHT_CHANNEL, locale: "fa-IR", trace: "off", screenshot: "off", video: "off" },
  projects: [{ name: "mobile", use: { viewport: { width: 390, height: 844 } } }, { name: "desktop", use: { viewport: { width: 1440, height: 900 } } }],
  webServer: { command: "pnpm dev --hostname 127.0.0.1 --port 3100", url: "http://127.0.0.1:3100/forgot-password",
    env: { NEXT_PUBLIC_API_URL_V1: api, UI_REVIEW_ENABLED: "0" }, reuseExistingServer: false, timeout: 120_000 },
});
