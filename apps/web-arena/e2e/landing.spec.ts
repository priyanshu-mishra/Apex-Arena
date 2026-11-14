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

test("credit is one statement with plain links", async ({ page }) => {
  await page.goto("/");
  const credit = page.locator("#c8");
  // One typeset statement at display scale, no small label above the name.
  await expect(credit.locator("p").first()).toHaveText("Built by Priyanshu Mishra.");
  await expect(credit).not.toContainText("Designed and built by");
  await expect(credit.getByRole("link", { name: "GitHub" })).toHaveAttribute(
    "href",
    "https://github.com/priyanshu-mishra",
  );
  // LINKEDIN_URL (content/landing.ts) is empty: the link stays hidden until it holds the real URL.
  await expect(credit.getByRole("link", { name: /LinkedIn/ })).toHaveCount(0);
});

test("no TODO text reaches visitors", async ({ page }) => {
  await page.goto("/?rm");
  await expect(page.locator("body")).not.toContainText(/TODO/);
  expect(await page.locator("[data-todo], a[href*='todo']").count()).toBe(0);
});

test("status line is a quiet live region", async ({ page }) => {
  await page.goto("/");
  const status = page.getByRole("status");
  await expect(status).toHaveAttribute("aria-live", "off");
  await expect(status).toContainText("seed");
  await expect(status).toContainText("simulated in your browser");
});

test("status lines open on the engine's ETH price, the one chapter 01 shows", async ({ request }) => {
  for (const path of ["/", "/enter"]) {
    const html = await (await request.get(path)).text();
    expect(html, path).not.toContain("2,241.50");
    const at = html.indexOf('aria-label="Market status"');
    expect(at, path).toBeGreaterThan(0);
    expect(html.slice(at, at + 2500), path).toContain(">2,142.31<");
  }
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

test("the chapter rail never covers the credit links", async ({ page }) => {
  await page.goto("/?rm");
  const rail = page.locator("nav[aria-label='Chapters']");
  // Put the credit links' row level with the rail's active (08) tick.
  await page.evaluate(() => {
    const link = Array.from(document.querySelectorAll<HTMLAnchorElement>("#c8 a")).find((a) => a.textContent === "GitHub")!;
    const tick = document.querySelector("nav[aria-label='Chapters'] a:last-child")!.getBoundingClientRect();
    const r = link.getBoundingClientRect();
    window.scrollBy(0, r.top + r.height / 2 - (tick.top + tick.height / 2));
  });
  await expect(rail.locator("a[aria-current='location']")).toHaveText("08 Credit");
  await expect(rail.locator("a[aria-current='location'] span")).toHaveCSS("opacity", "0");
  const hit = await page.evaluate(() => {
    const link = Array.from(document.querySelectorAll<HTMLAnchorElement>("#c8 a")).find((a) => a.textContent === "GitHub")!;
    const r = link.getBoundingClientRect();
    return document.elementFromPoint(r.left + 2, r.top + r.height / 2)?.closest("a")?.textContent;
  });
  expect(hit).toBe("GitHub");
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

/**
 * Sweeps the whole page and, at every step, checks each line of copy that
 * reaches the top bar's band: the mask on its block must have it at zero
 * alpha there. Glyph ink counts, not just line boxes: once a line's baseline
 * is inside the band, its descenders (measured from the font) must be clear
 * too. Returns the offending lines.
 */
async function copyUnderBar(page: import("@playwright/test").Page, step: number) {
  return page.evaluate(async (stride) => {
    const frame = () => new Promise((r) => requestAnimationFrame(() => r(null)));
    const header = document.querySelector("header")!;
    const band = header.getBoundingClientRect().bottom;
    const max = document.documentElement.scrollHeight - innerHeight;
    const bad: string[] = [];
    const texts: Text[] = [];
    const ctx = document.createElement("canvas").getContext("2d")!;
    /** Font descent (content-area bottom → baseline) and the text's ink descent, px. */
    const metrics = new Map<Text, { font: number; ink: number }>();
    const metricsOf = (t: Text) => {
      let m = metrics.get(t);
      if (!m) {
        const cs = getComputedStyle(t.parentElement!);
        ctx.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
        const tm = ctx.measureText(t.textContent!);
        m = { font: tm.fontBoundingBoxDescent, ink: tm.actualBoundingBoxDescent };
        metrics.set(t, m);
      }
      return m;
    };
    const walker = document.createTreeWalker(document.querySelector("main")!, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) if (n.textContent?.trim()) texts.push(n as Text);
    for (let y = 0; y <= max + stride; y += stride) {
      scrollTo(0, Math.min(y, max));
      await frame();
      await frame();
      for (const t of texts) {
        const range = document.createRange();
        range.selectNodeContents(t);
        for (const r of Array.from(range.getClientRects())) {
          if (r.width === 0 || r.top >= band || r.bottom <= 0) continue;
          const block = t.parentElement!.closest<HTMLElement>("[data-bar-clip] > *");
          const alphaAt = (at: number) => {
            if (!block?.hasAttribute("data-bar-clipping") || getComputedStyle(block).maskImage === "none") return 1;
            const top = block.getBoundingClientRect().top;
            const a = parseFloat(block.style.getPropertyValue("--bar-a"));
            const b = parseFloat(block.style.getPropertyValue("--bar-b"));
            return Math.min(1, Math.max(0, (at - (top + a)) / (b - a)));
          };
          const where = `y=${Math.min(y, max)}`;
          const what = t.textContent!.trim().slice(0, 30);
          // Alpha at the lowest point of the line still inside the band (the worst case).
          const alpha = alphaAt(Math.min(r.bottom, band));
          if (alpha > 0.02) bad.push(`${where} alpha=${alpha.toFixed(2)}: ${what}`);
          // The line's body is under the bar: its descenders must not hang below it.
          const m = metricsOf(t);
          const baseline = r.bottom - m.font;
          const ink = baseline + m.ink;
          if (baseline < band && ink > band) {
            const tail = alphaAt(ink);
            if (tail > 0.02) bad.push(`${where} descender alpha=${tail.toFixed(2)}: ${what}`);
          }
        }
      }
    }
    return [...new Set(bad)].slice(0, 12);
  }, step);
}

test("copy never runs under the top bar", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto("/?rm");
  expect(await copyUnderBar(page, 30)).toEqual([]);
});

test("the first viewport and settled chapters carry no bar mask", async ({ page }) => {
  await page.goto("/");
  await page.waitForTimeout(500);
  expect(await page.locator("[data-bar-clipping]").count()).toBe(0);
  // A sticky chapter at rest (stage pinned at the top) keeps its copy whole.
  for (const id of ["c1", "c2", "c3", "c4", "c5", "c6"]) {
    await page.evaluate((sel) => {
      const el = document.getElementById(sel)!;
      window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY + (el.offsetHeight - window.innerHeight) / 2);
    }, id);
    await page.waitForTimeout(150);
    expect(await page.locator(`#${id} [data-bar-clipping]`).count(), id).toBe(0);
  }
});

test.describe("copy and the top bar on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test("copy never runs under the top bar", async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto("/?rm");
    expect(await copyUnderBar(page, 30)).toEqual([]);
  });
});
