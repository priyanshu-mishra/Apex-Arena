import { expect, test } from "@playwright/test";

const ROUTES = ["/", "/enter", "/app", "/app/agents", "/app/benchmark", "/app/proof"];
const ORIGIN = "http://localhost:3000";

test("every route renders", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(e.message));
  for (const route of ROUTES) {
    const res = await page.goto(route);
    expect(res?.status(), route).toBe(200);
    await page.waitForLoadState("networkidle");
  }
  expect(errors).toEqual([]);
});

test("app pages share one running simulation", async ({ page }) => {
  const readTick = async () => {
    const text = (await page.getByTestId("sim-tick").first().textContent()) ?? "";
    return Number(text.replace(/[^0-9]/g, ""));
  };
  await page.goto("/app");
  await page.waitForTimeout(1500);
  const first = await readTick();
  expect(first).toBeGreaterThan(0);

  await page.getByRole("link", { name: /^agents/i }).click();
  await expect(page).toHaveURL(/\/app\/agents$/);
  await page.waitForTimeout(1000);
  await page.getByRole("link", { name: /^arena/i }).first().click();
  await expect(page).toHaveURL(/\/app$/);

  const second = await readTick();
  expect(second).toBeGreaterThan(first);
});

test("no cross-origin requests", async ({ page }) => {
  const urls: string[] = [];
  page.on("request", (r) => urls.push(r.url()));
  for (const route of ROUTES) {
    await page.goto(route);
    await page.waitForLoadState("networkidle");
  }
  const bad = urls.filter((u) => !u.startsWith(ORIGIN) && !u.startsWith("data:") && !u.startsWith("blob:"));
  expect(bad).toEqual([]);
});
