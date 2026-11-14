import { expect, test, type Page } from "@playwright/test";

const PAGES = ["/app", "/app/agents", "/app/benchmark", "/app/proof"];

/** Waits until the shell has hydrated and the worker is ticking. */
async function ready(page: Page) {
  await expect(page.getByRole("radiogroup", { name: "Density" })).toBeVisible();
  await expect
    .poll(async () => Number(((await page.getByTestId("sim-tick").textContent()) ?? "").replace(/\D/g, "")))
    .toBeGreaterThan(0);
}

async function setDensity(page: Page, d: "Simple" | "Pro") {
  await page.getByRole("radiogroup", { name: "Density" }).getByRole("radio", { name: d }).click();
}

test("simple hides advanced panels", async ({ page }) => {
  await page.goto("/app");
  await ready(page);
  // Simple: the story set only.
  await expect(page.getByRole("region", { name: "Price chart" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Order book" })).toBeVisible();
  await expect(page.getByRole("form", { name: "Order ticket" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Leaderboard" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "AMM swap" })).toHaveCount(0);

  await page.goto("/app/agents");
  await ready(page);
  await expect(page.getByRole("region", { name: "Reasoning traces" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Agent builder" })).toBeVisible();
  await expect(page.getByRole("region", { name: "MacroDigest" })).toHaveCount(0);

  await page.goto("/app/proof");
  await ready(page);
  await expect(page.getByRole("button", { name: "Verify 5-run Rust determinism" })).toBeVisible();
  await expect(page.getByRole("region", { name: "AMM and arbitrage calculator" })).toHaveCount(0);

  // Pro reveals the rest.
  await setDensity(page, "Pro");
  await expect(page.getByRole("region", { name: "AMM and arbitrage calculator" })).toBeVisible();
  await expect(page.getByRole("region", { name: "System architecture" })).toBeVisible();

  await page.goto("/app/agents");
  await ready(page);
  await expect(page.getByRole("region", { name: "MacroDigest" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Head-to-head" })).toBeVisible();

  await page.goto("/app");
  await ready(page);
  await expect(page.getByRole("tab", { name: "AMM swap" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Stress lab" })).toBeVisible();
});

test("benchmark runs", async ({ page }) => {
  await page.goto("/app/benchmark");
  await ready(page);
  await page.getByRole("button", { name: "Run the benchmark" }).click();
  const row = page.getByRole("region", { name: "Scorecard" }).getByRole("row").filter({ hasText: "MM-Alpha" });
  await expect(row).toContainText("F / Liquidated", { timeout: 15_000 });
});

test("proof verifies", async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto("/app/proof");
  await ready(page);
  await page.getByRole("button", { name: "Verify 5-run Rust determinism" }).click();
  const rows = page.getByTestId("hash-row").filter({ hasText: "4ee5fa37" });
  await expect(rows).toHaveCount(5, { timeout: 45_000 });
  await expect(page.getByTestId("verdict")).toHaveText("5 / 5 identical");
});

test("chart survives reset", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/app");
  await ready(page);
  await setDensity(page, "Pro");
  await page.getByRole("tab", { name: "Stress lab" }).click();
  await page.waitForTimeout(800);
  await page.getByRole("button", { name: "Reset to seed 42" }).click();
  await page.waitForTimeout(1500);
  for (const mode of ["Equity", "Drawdown", "Hawkes λ(t)", "Price"]) {
    await page.getByRole("group", { name: "Chart mode" }).getByRole("button", { name: mode, exact: true }).click();
  }
  await page.waitForTimeout(500);
  expect(errors.filter((e) => /lightweight|assert|time/i.test(e))).toEqual([]);
  expect(errors).toEqual([]);
});

test("no text under 12px on app pages", async ({ page }) => {
  for (const density of ["Simple", "Pro"] as const) {
    for (const path of PAGES) {
      await page.goto(path);
      await ready(page);
      await setDensity(page, density);
      await page.waitForTimeout(300);
      const small = await page.evaluate(() => {
        const out: string[] = [];
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        for (let n = walker.nextNode(); n; n = walker.nextNode()) {
          const text = n.textContent?.trim();
          const el = n.parentElement;
          if (!text || !el || el.closest("script,style,noscript")) continue;
          const size = parseFloat(getComputedStyle(el).fontSize);
          if (size < 12) out.push(`${size}px: ${text.slice(0, 40)}`);
        }
        return out;
      });
      expect(small, `${density} ${path}`).toEqual([]);
    }
  }
});

test("app pages follow the Canyon rules", async ({ page }) => {
  // Guide §2: 2px radius on controls and nothing rounder, no shadows, Archivo / Martian Mono only.
  for (const density of ["Simple", "Pro"] as const) {
    for (const path of PAGES) {
      await page.goto(path);
      await ready(page);
      await setDensity(page, density);
      await page.waitForTimeout(300);
      const bad = await page.evaluate(() => {
        const out: string[] = [];
        document.querySelectorAll("main *").forEach((el) => {
          if (el.closest("svg") && el.tagName.toLowerCase() !== "svg") return;
          const cs = getComputedStyle(el);
          const tag = `${el.tagName.toLowerCase()}.${String(el.className).slice(0, 40)}`;
          const r = Math.max(...[cs.borderTopLeftRadius, cs.borderTopRightRadius].map((v) => parseFloat(v) || 0));
          if (r > 2) out.push(`radius ${r}: ${tag}`);
          if (cs.boxShadow !== "none") out.push(`shadow: ${tag}`);
          if (!/Archivo|Martian/.test(cs.fontFamily)) out.push(`font ${cs.fontFamily}: ${tag}`);
        });
        return [...new Set(out)].slice(0, 20);
      });
      expect(bad, `${density} ${path}`).toEqual([]);
    }
  }
});

type RangeWindow = Window & { __apexChart?: { timeScale(): { getVisibleLogicalRange(): { from: number; to: number } | null } } };
const visibleWidth = (page: Page) =>
  page.evaluate(() => {
    const r = (window as RangeWindow).__apexChart?.timeScale().getVisibleLogicalRange();
    return r ? r.to - r.from : 0;
  });

test("price chart keeps the user's pan and zoom", async ({ page }) => {
  await page.goto("/app");
  await ready(page);
  const chart = page.getByRole("region", { name: "Price chart" }).getByRole("img").first();
  // Wait until the chart holds more than the first few candles (it stops auto-fitting then): 10 ticks a candle.
  await expect
    .poll(async () => Number(((await page.getByTestId("sim-tick").textContent()) ?? "").replace(/\D/g, "")), { timeout: 20_000 })
    .toBeGreaterThan(220);
  await expect.poll(() => visibleWidth(page)).toBeGreaterThan(8);
  const fitted = await visibleWidth(page);
  const box = await chart.boundingBox();
  if (!box) throw new Error("chart has no box");
  await page.mouse.move(box.x + box.width * 0.6, box.y + box.height / 2);
  for (let i = 0; i < 6; i++) {
    await page.mouse.wheel(0, -400);
    await page.waitForTimeout(60);
  }
  await page.waitForTimeout(300);
  const zoomed = await visibleWidth(page);
  expect(zoomed).toBeLessThan(fitted * 0.8);
  // Frames keep arriving; the zoom must survive them (no snap back to fit-content).
  await page.waitForTimeout(1200);
  const later = await visibleWidth(page);
  expect(Math.abs(later - zoomed)).toBeLessThan(0.5);
});

test("svg text keeps the 12px floor as drawn", async ({ page }) => {
  for (const [w, h] of [
    [390, 844],
    [1440, 900],
  ] as const) {
    await page.setViewportSize({ width: w, height: h });
    for (const path of PAGES) {
      await page.goto(path);
      await ready(page);
      await setDensity(page, "Pro");
      await page.waitForTimeout(300);
      // Rendered size = CSS font-size × the SVG's current scale (viewBox → screen).
      const small = await page.evaluate(() => {
        const out: string[] = [];
        document.querySelectorAll<SVGTextElement>("main svg text").forEach((el) => {
          const r = el.getBoundingClientRect();
          const ctm = el.getScreenCTM();
          if (!ctm || r.width === 0 || r.height === 0 || !el.textContent?.trim()) return;
          const drawn = parseFloat(getComputedStyle(el).fontSize) * Math.hypot(ctm.a, ctm.b);
          if (drawn < 11.95) out.push(`${drawn.toFixed(1)}px: ${el.textContent.trim().slice(0, 30)}`);
        });
        return [...new Set(out)].slice(0, 10);
      });
      expect(small, `${w}px ${path}`).toEqual([]);
    }
  }
});
