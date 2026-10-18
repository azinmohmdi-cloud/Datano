import { defineConfig } from "@playwright/test";

// Adapter-level transport tests do not need a browser or the Next.js UI server.
process.env.NEXT_PUBLIC_API_URL_V1 = "https://api.datano.test";

export default defineConfig({
  testDir: "./tests/transport",
  testMatch: "transport.spec.ts",
  workers: 1,
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  timeout: 10_000,
  reporter: "list",
  outputDir: "test-results/transport",
});
