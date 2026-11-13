import { expect, test, type Page } from "@playwright/test";

/** Waits until the shell has hydrated and the worker is ticking. */
async function ready(page: Page) {
  await expect(page.getByRole("radiogroup", { name: "Density" })).toBeVisible();
  await expect
    .poll(async () => Number(((await page.getByTestId("sim-tick").textContent()) ?? "").replace(/\D/g, "")))
    .toBeGreaterThan(0);
}

test("density toggle persists", async ({ page }) => {
  await page.goto("/app");
  await ready(page);
  const density = page.getByRole("radiogroup", { name: "Density" });
  await expect(density.getByRole("radio", { name: "Simple" })).toBeChecked();
  // Pro-only status fields are absent in Simple.
  await expect(page.getByTestId("status-digest")).toHaveCount(0);

  await density.getByRole("radio", { name: "Pro" }).click();
  await expect(density.getByRole("radio", { name: "Pro" })).toBeChecked();
  await expect(page.getByTestId("status-digest")).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("apex-density"))).toBe("pro");

  await page.reload();
  await ready(page);
  await expect(page.getByRole("radiogroup", { name: "Density" }).getByRole("radio", { name: "Pro" })).toBeChecked();
  await expect(page.getByTestId("status-digest")).toBeVisible();

  await page.getByRole("radiogroup", { name: "Density" }).getByRole("radio", { name: "Simple" }).click();
  expect(await page.evaluate(() => localStorage.getItem("apex-density"))).toBe("simple");
  await expect(page.getByTestId("status-digest")).toHaveCount(0);
});

test("command menu navigates", async ({ page }) => {
  await page.goto("/app");
  await ready(page);
  await page.keyboard.press("ControlOrMeta+k");
  const menu = page.getByRole("dialog", { name: "Command menu" });
  await expect(menu).toBeVisible();
  await page.keyboard.type("bench");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/app\/benchmark$/);
  await expect(menu).toHaveCount(0);
});

test("keys 1–4 navigate", async ({ page }) => {
  await page.goto("/app");
  await ready(page);
  const nav = page.getByRole("navigation", { name: "App sections" });
  const expectations: [string, RegExp, string][] = [
    ["2", /\/app\/agents$/, "Agents"],
    ["3", /\/app\/benchmark$/, "Benchmark"],
    ["4", /\/app\/proof$/, "Proof"],
    ["1", /\/app$/, "Arena"],
  ];
  for (const [key, url, label] of expectations) {
    await page.keyboard.press(key);
    await expect(page).toHaveURL(url);
    await expect(nav.getByRole("link", { name: label })).toHaveAttribute("aria-current", "page");
  }
});

test("space pauses and . steps one tick", async ({ page }) => {
  await page.goto("/app");
  await ready(page);
  const tick = async () => Number(((await page.getByTestId("sim-tick").textContent()) ?? "").replace(/\D/g, ""));
  await page.keyboard.press("Space");
  await expect(page.getByTestId("sim-state")).toHaveText(/paused/);
  await page.waitForTimeout(300);
  const before = await tick();
  await page.keyboard.press(".");
  await expect.poll(tick).toBe(before + 1);
  await page.keyboard.press("Space");
  await expect(page.getByTestId("sim-state")).toHaveText(/running/);
});

test("shell works on a phone", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/app");
  await ready(page);
  // The shell's own chrome fits (page bodies are re-laid out in Task 10).
  const overflow = await page.evaluate(() => {
    const chrome = document.querySelectorAll("[data-chrome], [data-chrome] *");
    let worst = 0;
    for (const el of chrome) worst = Math.max(worst, el.getBoundingClientRect().right - window.innerWidth);
    return worst;
  });
  expect(overflow).toBeLessThanOrEqual(0);
  await expect(page.getByRole("radiogroup", { name: "Density" })).toBeInViewport();
  await page.getByRole("button", { name: "Menu" }).click();
  const sheet = page.getByRole("dialog", { name: "Menu" });
  await expect(sheet).toBeVisible();
  await sheet.getByRole("link", { name: "Agents" }).click();
  await expect(page).toHaveURL(/\/app\/agents$/);
  await expect(sheet).toHaveCount(0);
});
