import { defineConfig } from "@playwright/test";

const baseURL = "http://127.0.0.1:3100";
const channel = process.env.PLAYWRIGHT_CHANNEL;
if (channel && channel !== "chrome") {
  throw new Error("PLAYWRIGHT_CHANNEL must be chrome or unset for bundled Chromium.");
}

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: true,
  retries: 0,
  workers: 1,
  timeout: 30_000,
  globalTimeout: 300_000,
  expect: { timeout: 10_000 },
  reporter: [["list"], ["html", { open: "never" }]],
  outputDir: "test-results",
  use: {
    baseURL,
    browserName: "chromium",
    channel,
    locale: "fa-IR",
    timezoneId: "Asia/Tehran",
    colorScheme: "light",
    contextOptions: { reducedMotion: "reduce" },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "mobile",
      use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
    },
    {
      name: "desktop",
      use: { viewport: { width: 1440, height: 900 } },
    },
  ],
  webServer: {
    command: "pnpm dev --hostname 127.0.0.1 --port 3100",
    url: `${baseURL}/ui-review`,
    env: { NODE_ENV: "development", UI_REVIEW_ENABLED: "1" },
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
