import { test, expect } from "@playwright/test";

test("legacy user mocks retain their development read and validation contracts", async ({ request }) => {
  const collection = await request.get("/api/users");
  expect(collection.status()).toBe(200);
  expect(await collection.json()).toEqual(expect.arrayContaining([
    { id: 1, name: "Alice", email: "alice@example.com" },
    { id: 2, name: "Bob", email: "bob@example.com" },
  ]));
  const detail = await request.get("/api/users/1");
  expect(detail.status()).toBe(200);
  expect(await detail.json()).toEqual({ id: 1, name: "Alice", email: "alice@example.com" });
  expect((await request.get("/api/users/999999")).status()).toBe(404);
  expect((await request.post("/api/users", { data: {} })).status()).toBe(400);
  const created = await request.post("/api/users", { data: { name: "Example test", email: "example-test@example.test" } });
  expect(created.status()).toBe(201);
  expect(await created.json()).toMatchObject({ name: "Example test", email: "example-test@example.test" });
});

test("legacy invoice examples still render controlled success and failure in development", async ({ page, context }) => {
  await context.addInitScript(() => { Math.random = () => new URL(location.href).searchParams.get("exampleOutcome") === "failure" ? 0.1 : 0.5; });
  for (const [path, heading, invoices] of [
    ["/examples/me/invoices", "My Invoices", ["INV002", "INV003"]],
    ["/examples/admin/invoices", "Admin Invoices", ["INV006", "INV007", "INV008", "INV009", "INV010"]],
  ] as const) {
    expect((await page.goto(path))?.status()).toBe(200);
    await expect(page.getByRole("heading", { name: heading, exact: true })).toBeVisible();
    await expect(page.locator("tbody tr")).toHaveCount(invoices.length);
    for (const invoice of invoices) await expect(page.getByRole("cell", { name: invoice, exact: true })).toBeVisible();
  }
  for (const path of ["/examples/me/invoices", "/examples/admin/invoices"]) {
    await page.goto(`${path}?exampleOutcome=failure`);
    await expect(page.getByText("Failed to load invoices.", { exact: true })).toBeVisible();
    await expect(page.getByRole("table")).toHaveCount(0);
  }
});
