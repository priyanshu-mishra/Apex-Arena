import { expect, test } from "@playwright/test";

test.use({ viewport: { width: 1440, height: 900 } });

test("hero shows the approved copy", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("A market that fights back.");
  const hero = page.locator("#c0");
  await expect(hero.getByRole("link", { name: "Enter the arena" })).toBeVisible();
  await expect(hero.getByRole("button", { name: "Crash the market" })).toBeVisible();
});

test("depth toggle persists", async ({ page }) => {
  await page.goto("/");
  const precise = page.locator("#c0 [data-precise]");
  await expect(precise).toBeHidden();
  await page.getByRole("button", { name: "Precise", exact: true }).click();
  await expect(precise).toBeVisible();
  await expect(page.getByRole("button", { name: "Precise", exact: true })).toHaveAttribute("aria-pressed", "true");

  await page.reload();
  await expect(precise).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("apex-depth"))).toBe("precise");
  await expect(page.locator("html")).toHaveAttribute("data-depth", "precise");
});

test("enter the arena goes to the gate", async ({ page }) => {
  await page.goto("/");
  await page.locator("#c0").getByRole("link", { name: "Enter the arena" }).click();
  await expect(page).toHaveURL(/\/enter$/);
});

test("credit links", async ({ page }) => {
  await page.goto("/");
  const credit = page.locator("#c8");
  await expect(credit.getByRole("link", { name: "GitHub" })).toHaveAttribute(
    "href",
    "https://github.com/priyanshu-mishra",
  );
  const linkedIn = credit.getByRole("link", { name: /LinkedIn/ });
  await expect(linkedIn).toContainText("TODO: LinkedIn URL");
});

test("status line is a quiet live region", async ({ page }) => {
  await page.goto("/");
  const status = page.getByRole("status");
  await expect(status).toHaveAttribute("aria-live", "off");
  await expect(status).toContainText("seed");
  await expect(status).toContainText("simulated in your browser");
});

test("chapters have the guide's heights", async ({ page }) => {
  await page.goto("/?rm");
  const heights = await page.evaluate(() =>
    Array.from(document.querySelectorAll("main > section")).map((s) => ({
      id: s.id,
      vh: Math.round((s.getBoundingClientRect().height / window.innerHeight) * 100),
    })),
  );
  expect(heights.map((h) => h.id)).toEqual(["c0", "c1", "c2", "c3", "c4", "c5", "c6", "c7", "c8", "c9"]);
  expect(heights.slice(0, 7).map((h) => h.vh)).toEqual([100, 190, 180, 190, 250, 190, 270]);
});

test("scrolling drives the scene chapter", async ({ page }) => {
  await page.goto("/?rm");
  await page.evaluate(() => {
    const top = document.getElementById("c7")!.getBoundingClientRect().top + window.scrollY;
    window.scrollTo(0, top);
  });
  await expect(page.locator("nav[aria-label='Chapters'] a[aria-current='location']")).toHaveText("07 Stack");
});

test("reduced motion shows every title without reveals", async ({ page }) => {
  await page.goto("/?rm");
  await expect(page.locator("html")).not.toHaveAttribute("data-motion", /.*/);
  const transforms = await page.evaluate(() =>
    Array.from(document.querySelectorAll("[data-ln] > span, [data-rv]")).map((el) => ({
      transform: getComputedStyle(el).transform,
      opacity: getComputedStyle(el).opacity,
    })),
  );
  expect(transforms.length).toBeGreaterThan(0);
  for (const t of transforms) {
    expect(t.transform).toBe("none");
    expect(t.opacity).toBe("1");
  }
});

test("no text under 12px", async ({ page }) => {
  await page.goto("/?rm");
  await page.getByRole("button", { name: "Precise", exact: true }).click();
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
  expect(small).toEqual([]);
});
