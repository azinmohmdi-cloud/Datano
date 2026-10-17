import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { chromium } from "@playwright/test";

// Run from Frontend after UI_REVIEW_ENABLED=1 pnpm build.
const baseURL = "http://127.0.0.1:3104";
const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", "3104"], {
  env: { ...process.env, UI_REVIEW_ENABLED: "1" }, stdio: ["ignore", "pipe", "pipe"],
});
let output = "", browser, responses = 0;
const failures = [];
server.stdout.on("data", data => { output += data; });
server.stderr.on("data", data => { output += data; });
const check = (condition, message) => { if (!condition) failures.push(message); };

async function filesIn(directory) {
  return (await Promise.all((await readdir(directory, { withFileTypes: true })).map(entry =>
    entry.isDirectory() ? filesIn(`${directory}/${entry.name}`) : `${directory}/${entry.name}`,
  ))).flat();
}

try {
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    if (server.exitCode !== null) throw new Error(`Production server exited: ${output}`);
    try { ready = (await fetch(baseURL)).status === 200; } catch { /* Still starting. */ }
    if (ready) break;
    await delay(100);
  }
  assert(ready, `Production server did not become ready: ${output}`);
  const invoicePaths = ["/examples/me/invoices", "/examples/admin/invoices"];
  const reviewPaths = (await filesIn("app/ui-review")).filter(path => path.endsWith("/page.review.tsx"))
    .map(path => `/${path.slice(4, -"/page.review.tsx".length).replace("[recommendationId]", "record-one")}`);
  for (const path of ["/api/users", "/api/users/1", "/api/users/999999", ...invoicePaths, ...reviewPaths]) {
    for (const headers of [{}, { RSC: "1", "Next-Router-Prefetch": "1" }]) {
      const response = await fetch(`${baseURL}${path}?role=admin&preview=1`, { headers });
      const body = await response.text();
      check(response.status === 404, `${path} returned ${response.status}, expected 404`);
      for (const marker of ["alice@example.com", "bob@example.com", "My Invoices", "Admin Invoices", "INV002", "INV006", "UI_REVIEW_ADMIN_USER_", "ui-review-user@example.test"])
        check(!body.includes(marker), `${path} disclosed ${marker}`);
      responses++;
    }
  }
  for (const [path, options] of [
    ["/api/users", { method: "HEAD" }], ["/api/users/1", { method: "HEAD" }],
    ["/api/users", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Blocked", email: "blocked@example.test" }) }],
    ["/api/users", { method: "POST", headers: { "Content-Type": "application/json" }, body: "invalid-json" }],
  ]) {
    const response = await fetch(`${baseURL}${path}`, options);
    check(response.status === 404, `${options.method} ${path} returned ${response.status}, expected 404`);
    responses++;
  }
  for (const path of ["/", "/profile", "/api/health"]) {
    check((await fetch(`${baseURL}${path}`)).status === 200, `${path} no longer responds normally`);
    responses++;
  }
  const manifest = JSON.parse(await readFile(".next/server/app-paths-manifest.json", "utf8"));
  check(Object.keys(manifest).every(path => !path.includes("ui-review")), "Private review route appeared in the production manifest");
  const bundles = (await filesIn(".next/static")).filter(path => path.endsWith(".js"));
  for (const path of bundles) {
    const code = await readFile(path, "utf8");
    for (const marker of ["INV002", "INV006", "MOCKED_MY_INVOICES", "MOCKED_ADMIN_INVOICES", "ui-review-user@example.test", "UI_REVIEW_ADMIN_USER_"])
      check(!code.includes(marker), `Sample fixture ${marker} leaked into ${path}`);
  }
  browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || undefined });
  for (const width of [390, 1440]) for (const javaScriptEnabled of [false, true]) {
    const context = await browser.newContext({ baseURL, javaScriptEnabled, viewport: { width, height: 900 } });
    try {
      const page = await context.newPage();
      for (const path of invoicePaths) {
        const response = await page.goto(path);
        check(response?.status() === 404, `Browser ${width}/${javaScriptEnabled}: ${path} was accessible`);
        check(await page.getByRole("table").count() === 0, `Browser rendered an invoice table at ${path}`);
      }
    } finally { await context.close(); }
  }
  console.log(JSON.stringify({ responses, clientBundles: bundles.length, privateReviewRoutes: reviewPaths.length, failures }, null, 2));
  assert.deepEqual(failures, []);
} finally {
  if (browser) await browser.close();
  server.kill("SIGTERM");
}
