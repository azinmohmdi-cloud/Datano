import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { chromium } from "@playwright/test";

// Run from Frontend after UI_REVIEW_ENABLED=1 pnpm build.
const baseURL = "http://127.0.0.1:3101";
const manifest = JSON.parse(await readFile(".next/server/app-paths-manifest.json", "utf8"));
assert(Object.keys(manifest).some((key) => key.includes("/websites/[websiteId]/recommendations/page")));
assert(Object.keys(manifest).every((key) => !key.includes("ui-review")));
assert(Object.keys(manifest).every((key) => !key.includes("[recommendationId]")));

async function filesIn(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  return (await Promise.all(entries.map((entry) => entry.isDirectory() ? filesIn(`${directory}/${entry.name}`) : `${directory}/${entry.name}`))).flat();
}
const files = (await filesIn(".next/static")).filter((path) => path.endsWith(".js"));
for (const path of files) {
  const code = await readFile(path, "utf8");
  for (const marker of ["UI_REVIEW_RECOMMENDATION_", "بررسی افت نشست‌های سایت", "سناریوی پیشنهادها", "getRecommendationReviewInput"]) assert(!code.includes(marker), `Private fixture leaked into ${path}`);
}

const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", "3101"], { env: { ...process.env, UI_REVIEW_ENABLED: "1" }, stdio: ["ignore", "pipe", "pipe"] });
let output = "";
server.stdout.on("data", (data) => { output += data; });
server.stderr.on("data", (data) => { output += data; });
let browser;
let requests = 0;
try {
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    if (server.exitCode !== null) throw new Error(`Production server exited: ${output}`);
    try { const response = await fetch(`${baseURL}/websites/check/recommendations`); ready = response.status === 200; } catch { /* Server is still starting. */ }
    if (ready) break;
    await delay(100);
  }
  assert(ready, `Production server did not become ready: ${output}`);
  for (const path of ["/ui-review/websites/recommendations", "/ui-review/websites/recommendations?site=report-ready&scenario=all-sources", "/websites/check/recommendations/UI_REVIEW_RECOMMENDATION_GA4"]) {
    for (const headers of [{}, { RSC: "1", "Next-Router-Prefetch": "1" }]) {
      const response = await fetch(`${baseURL}${path}`, { headers });
      assert.equal(response.status, 404, path);
      const body = await response.text();
      assert(!body.includes("بررسی افت نشست‌های سایت"));
      requests++;
    }
  }
  for (const path of ["/websites/check/recommendations", "/websites/report-ready/recommendations?scenario=all-sources&role=admin&verified=1"]) {
    for (const headers of [{}, { RSC: "1" }]) {
      const response = await fetch(`${baseURL}${path}`, { headers });
      assert.equal(response.status, 200);
      const body = await response.text();
      for (const marker of ["UI_REVIEW_RECOMMENDATION_", "بررسی افت نشست‌های سایت", "data-review-tools", "data-recommendation-row"]) assert(!body.includes(marker));
      requests++;
    }
  }
  browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || undefined });
  for (const javaScriptEnabled of [false, true]) {
    const context = await browser.newContext({ baseURL, javaScriptEnabled, viewport: { width: 390, height: 844 } });
    try {
      const page = await context.newPage();
      const mutations = [], errors = [];
      page.on("request", (request) => { if (request.method() !== "GET" || new URL(request.url()).pathname.startsWith("/api/")) mutations.push(request.url()); });
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto("/websites/report-ready/recommendations?role=admin&scenario=all-sources");
      assert(await page.getByText("برای مشاهدهٔ پیشنهادهای این سایت، وارد شوید.", { exact: true }).isVisible());
      assert.equal(await page.locator("[data-recommendation-row], select, [data-review-tools]").count(), 0);
      assert.equal(await page.getByRole("contentinfo").count(), 1);
      assert.deepEqual(await context.cookies(), []);
      assert.deepEqual(await page.evaluate(() => ({ local: { ...localStorage }, session: { ...sessionStorage } })), { local: {}, session: {} });
      await page.getByRole("main").getByRole("link", { name: "ورود به حساب", exact: true }).click();
      await page.waitForURL("/login");
      assert.equal(new URL(page.url()).pathname, "/login");
      assert.deepEqual(mutations, []);
      assert.deepEqual(errors, []);
    } finally { await context.close(); }
  }
  console.log(`Passed: production manifest, ${files.length} client bundles, ${requests} HTTP/RSC responses, access and login with/without JavaScript.`);
} finally {
  if (browser) await browser.close();
  server.kill("SIGTERM");
}
