import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { chromium } from "@playwright/test";

// Run from Frontend after UI_REVIEW_ENABLED=1 pnpm build.
const baseURL = "http://127.0.0.1:3102";
const manifest = JSON.parse(await readFile(".next/server/app-paths-manifest.json", "utf8"));
assert(Object.keys(manifest).some(key => key.endsWith("/admin/users/page")));
assert(Object.keys(manifest).every(key => !key.includes("ui-review")));
const privateMarkers = ["UI_REVIEW_ADMIN_SUMMARY", "adminReviewFixtures", "سناریوی آمار مدیر", "UI_REVIEW_ADMIN_USER_", "UI_REVIEW_ADMIN_SITE_", "adminUserReviewFixtures", "sara.admin-review@example.test"];

async function filesIn(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  return (await Promise.all(entries.map(entry => entry.isDirectory() ? filesIn(`${directory}/${entry.name}`) : `${directory}/${entry.name}`))).flat();
}
const files = (await Promise.all([filesIn(".next/static"), filesIn(".next/server")])).flat().filter(path => path.endsWith(".js"));
for (const path of files) {
  const code = await readFile(path, "utf8");
  for (const marker of privateMarkers) assert(!code.includes(marker), `Private admin fixture leaked into ${path}`);
}

const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", "3102"], {
  env: { ...process.env, UI_REVIEW_ENABLED: "1" }, stdio: ["ignore", "pipe", "pipe"],
});
let output = "", browser, responses = 0;
server.stdout.on("data", data => { output += data; });
server.stderr.on("data", data => { output += data; });
try {
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    if (server.exitCode !== null) throw new Error(`Production server exited: ${output}`);
    try { ready = (await fetch(`${baseURL}/admin/users`)).status === 200; } catch { /* Still starting. */ }
    if (ready) break;
    await delay(100);
  }
  assert(ready, `Production server did not become ready: ${output}`);
  for (const path of ["/ui-review/admin/users", "/ui-review/admin/users?persona=admin&scenario=ready", "/ui-review/admin/users/"]) {
    for (const headers of [{}, { RSC: "1", "Next-Router-Prefetch": "1" }]) {
      const response = await fetch(`${baseURL}${path}`, { headers });
      assert.equal(response.status, 404, path);
      const body = await response.text();
      for (const marker of [...privateMarkers, "data-admin-metric", "data-admin-user-row"]) assert(!body.includes(marker));
      responses++;
    }
  }
  for (const path of ["/admin/users", "/admin/users?persona=admin&role=admin&scenario=ready&users=ready&totalUsers=999999"]) {
    for (const headers of [{}, { RSC: "1", Cookie: "role=admin; persona=admin" }]) {
      const response = await fetch(`${baseURL}${path}`, { headers });
      assert.equal(response.status, 200);
      const body = await response.text();
      for (const marker of [...privateMarkers, "data-admin-metric", "data-admin-users", "data-admin-user-row", "data-review-tools", "/ui-review/admin/users"]) assert(!body.includes(marker));
      responses++;
    }
  }
  browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || undefined });
  for (const javaScriptEnabled of [false, true]) {
    const context = await browser.newContext({ baseURL, javaScriptEnabled, viewport: { width: 390, height: 844 } });
    try {
      const page = await context.newPage(), requests = [], errors = [];
      page.on("request", request => { if (request.method() !== "GET" || new URL(request.url()).pathname.startsWith("/api/")) requests.push(request.url()); });
      page.on("pageerror", error => errors.push(error.message));
      await page.goto("/admin/users?persona=admin&role=admin&scenario=ready&users=ready");
      assert(await page.getByText("برای مشاهدهٔ پنل مدیریت، وارد شوید.", { exact: true }).isVisible());
      assert.equal(await page.locator('[data-admin-metric], [data-admin-users], [data-admin-user-row], [data-review-tools], select, a[href^="/ui-review"]').count(), 0);
      assert.equal(await page.getByRole("banner").count(), 1);
      assert.equal(await page.getByRole("main").count(), 1);
      assert.equal(await page.getByRole("contentinfo").count(), 1);
      assert.deepEqual(await context.cookies(), []);
      assert.deepEqual(await page.evaluate(() => ({ local: { ...localStorage }, session: { ...sessionStorage } })), { local: {}, session: {} });
      await page.getByRole("main").getByRole("link", { name: "ورود به حساب", exact: true }).click();
      await page.waitForURL("/login");
      assert.deepEqual(requests, []);
      assert.deepEqual(errors, []);
    } finally { await context.close(); }
  }
  console.log(`Passed: production manifest, ${files.length} server/client bundles, ${responses} HTTP/RSC responses, guest access/login with and without JavaScript.`);
} finally {
  if (browser) await browser.close();
  server.kill("SIGTERM");
}
