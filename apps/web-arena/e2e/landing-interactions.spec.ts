import { expect, test, type Page } from "@playwright/test";

test.use({ viewport: { width: 1440, height: 900 } });

/** Scroll so the sticky chapter `id` is `p` (0–1) of the way through its stage. */
async function scrollChapterTo(page: Page, id: string, p: number) {
  await page.evaluate(
    ([sel, prog]) => {
      const el = document.getElementById(sel as string)!;
      const top = el.getBoundingClientRect().top + window.scrollY;
      const travel = el.offsetHeight - window.innerHeight;
      window.scrollTo(0, Math.round(top + travel * (prog as number)));
    },
    [id, p] as const,
  );
}

type CanyonProbe = { chapter: number; blend: number };
const readCanyon = (page: Page) =>
  page.evaluate(() => {
    const s = (window as unknown as { __canyonState?: () => CanyonProbe }).__canyonState?.();
    return s ? { chapter: s.chapter, blend: s.blend } : null;
  });

test("order slider walks the real ladder", async ({ page }) => {
  await page.goto("/?rm");
  const c1 = page.locator("#c1");
  const slider = c1.getByRole("slider", { name: /Your buy order/ });
  await slider.fill("30");
  await expect(c1).toContainText("5 of 7 price levels cleared");
  await slider.fill("12");
  await expect(c1.getByTestId("impact-bps")).toContainText("+17.3");
  await expect(c1).toContainText("3 of 7 price levels cleared");
  await expect(c1.getByTestId("impact-avg")).toHaveText("2,144.33");
  await expect(c1.getByRole("button", { name: "Send it" })).toBeVisible();
});

test("mood triggers update the status line", async ({ page }) => {
  await page.goto("/?rm");
  await page.waitForSelector('canvas[data-canyon][data-state="running"]', { timeout: 30_000 });
  await scrollChapterTo(page, "c3", 0.5);
  const crash = page.locator("#c3").getByRole("button", { name: /Flash crash/ });
  await crash.click();
  await expect(crash).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("status")).toContainText("flash crash", { timeout: 1000 });
});

test("score table shows engine output", async ({ page }) => {
  await page.goto("/?rm");
  const table = page.locator("#c5 table");
  const rows = table.locator("tbody tr");
  await expect(rows).toHaveCount(4);
  const expected = [
    ["Gemini-2.5", "0.883"],
    ["DeepSeek-R1", "0.881"],
    ["Hawkes-HFT", "0.234"],
    ["MM-Alpha", "0.000"],
  ];
  for (let i = 0; i < expected.length; i++) {
    await expect(rows.nth(i).locator("td").first()).toContainText(expected[i][0]);
    await expect(rows.nth(i).locator("td").last()).toHaveText(expected[i][1]);
  }
  const dead = rows.nth(3);
  await expect(dead).toContainText("liquidated at the 5% margin limit");
  const deco = await dead.locator("td").first().evaluate((el) => getComputedStyle(el).textDecorationLine);
  expect(deco).toContain("line-through");

  const psr = table.getByRole("columnheader", { name: "PSR" });
  await expect(psr).toBeHidden();
  await page.getByRole("button", { name: "Precise", exact: true }).click();
  for (const name of ["PSR", "Calmar", "Survival"])
    await expect(table.getByRole("columnheader", { name })).toBeVisible();
  await expect(rows.nth(0)).toContainText("0.9999");
});

test("proof rows reach five of five", async ({ page }) => {
  await page.goto("/?rm");
  const c6 = page.locator("#c6");
  await scrollChapterTo(page, "c6", 0.02);
  await expect(c6.getByTestId("verdict")).toHaveText("0 / 5 identical");
  await scrollChapterTo(page, "c6", 0.6);
  await expect(c6.getByTestId("verdict")).toHaveText("5 / 5 identical");
  await expect(c6.getByRole("link", { name: "Verify it yourself in the app" })).toHaveAttribute(
    "href",
    "/app/proof",
  );
});

test("barrier holds the clock", async ({ page }) => {
  await page.goto("/?rm");
  const c4 = page.locator("#c4");
  const hold = c4.getByText("market held · thinking agents answer");
  await scrollChapterTo(page, "c4", 0.2);
  await expect(c4.getByTestId("fast-clock")).not.toHaveText("000");
  await expect(hold).toHaveCSS("opacity", "0");
  await scrollChapterTo(page, "c4", 0.6);
  await expect(c4.getByTestId("fast-clock")).toHaveText("100");
  await expect(hold).toHaveCSS("opacity", "1");
});

test("scene blend follows scroll", async ({ page }) => {
  await page.goto("/?rm");
  await expect.poll(() => readCanyon(page)).toEqual({ chapter: 0, blend: 1 });
  // c1 half risen: its top sits halfway up the viewport.
  await page.evaluate(() => {
    const top = document.getElementById("c1")!.getBoundingClientRect().top + window.scrollY;
    window.scrollTo(0, Math.round(top - window.innerHeight / 2));
  });
  await expect.poll(async () => (await readCanyon(page))?.chapter).toBe(1);
  const half = await readCanyon(page);
  expect(half!.blend).toBeGreaterThan(0.4);
  expect(half!.blend).toBeLessThan(0.6);
  // Back at the top, inside c0, the blend is pinned to 1.
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect.poll(() => readCanyon(page)).toEqual({ chapter: 0, blend: 1 });
});

test.describe("phone", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("no text under 12px and no sideways scroll", async ({ page }) => {
    await page.goto("/?rm&precise");
    await expect(page.locator("html")).toHaveAttribute("data-depth", "precise");
    const result = await page.evaluate(() => {
      const small: string[] = [];
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        const text = n.textContent?.trim();
        const el = n.parentElement;
        if (!text || !el || el.closest("script,style,noscript")) continue;
        const size = parseFloat(getComputedStyle(el).fontSize);
        if (size < 12) small.push(`${size}px: ${text.slice(0, 40)}`);
      }
      return { small, overflow: document.documentElement.scrollWidth - window.innerWidth };
    });
    expect(result.small).toEqual([]);
    expect(result.overflow).toBeLessThanOrEqual(0);
    await expect(page.locator("#c6").getByText("4ee5fa37…58725614").first()).toBeVisible();
  });
});
