import { defineConfig } from "@playwright/test";

process.env.NEXT_PUBLIC_API_URL_V1 = "https://api.datano.test";
export default defineConfig({ testDir: "./tests/websites", testMatch: ["websites.spec.ts", "proof.spec.ts"], workers: 1,
  fullyParallel: false, forbidOnly: true, retries: 0, timeout: 10_000, reporter: "list", outputDir: "test-results/websites-unit" });
