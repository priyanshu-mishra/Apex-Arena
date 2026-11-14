import { expect, test, type Page } from "@playwright/test";

/*
 * Google's latin subsets leave out "→" and the other symbols the copy uses;
 * public/fonts/*-symbols.woff2 supply them from the same fonts. These checks
 * ask Chromium which font files actually drew a node's text, so a symbol that
 * falls back to a system font (Helvetica, Menlo, …) fails.
 */

async function platformFonts(page: Page, selector: string) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("DOM.enable");
  await cdp.send("CSS.enable");
  const { root } = await cdp.send("DOM.getDocument", { depth: -1 });
  const { nodeId } = await cdp.send("DOM.querySelector", { nodeId: root.nodeId, selector });
  expect(nodeId, `no node for ${selector}`).toBeGreaterThan(0);
  const { fonts } = await cdp.send("CSS.getPlatformFontsForNode", { nodeId });
  await cdp.detach();
  return fonts as { familyName: string; isCustomFont: boolean; glyphCount: number }[];
}

test.use({ viewport: { width: 1440, height: 900 } });

test("the Precise line's arrow renders in Martian Mono", async ({ page }) => {
  await page.goto("/?rm");
  await page.getByRole("button", { name: "Precise", exact: true }).click();
  const line = page.locator("#c0 [data-precise]");
  await expect(line).toBeVisible();
  await expect(line).toContainText("seed 42 →");
  await page.evaluate(() => document.fonts.ready);

  const fonts = await platformFonts(page, "#c0 [data-precise]");
  expect(fonts.length).toBeGreaterThan(0);
  for (const f of fonts) {
    expect(f.isCustomFont, `${f.familyName} is a system font`).toBe(true);
    expect(f.familyName).toMatch(/Martian Mono/);
  }
});

test("an arrow in body text renders in Archivo", async ({ page }) => {
  await page.goto("/enter?rm");
  await page.evaluate(async () => {
    const el = document.createElement("p");
    el.id = "arrow-probe";
    el.textContent = "Swap ETH → USDT · ≈ 10⁸";
    document.body.append(el);
    await document.fonts.load('16px "Archivo Symbols"', "→");
    await document.fonts.ready;
  });

  const fonts = await platformFonts(page, "#arrow-probe");
  expect(fonts.length).toBeGreaterThan(0);
  for (const f of fonts) {
    expect(f.isCustomFont, `${f.familyName} is a system font`).toBe(true);
    expect(f.familyName).toMatch(/Archivo/);
  }
});
