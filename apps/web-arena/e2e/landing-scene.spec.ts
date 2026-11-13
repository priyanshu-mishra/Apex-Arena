import { expect, test, type Page } from "@playwright/test";
import sharp from "sharp";

const INK: [number, number, number] = [0x05, 0x06, 0x08];

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(e.message));
  return errors;
}

const distance = (a: [number, number, number], b: [number, number, number]) =>
  Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]);

/**
 * Screenshot with everything but the scene canvas hidden, decoded with sharp.
 * Returns the brightest pixel of a 21×21 patch at the viewport centre: the
 * point lattice has ink-coloured gaps a single pixel can fall into.
 */
async function centrePixel(page: Page): Promise<[number, number, number]> {
  await page.addStyleTag({
    content: "body * { visibility: hidden !important; } canvas[data-canyon] { visibility: visible !important; }",
  });
  const png = await page.screenshot();
  const { data, info } = await sharp(png).raw().toBuffer({ resolveWithObject: true });
  const cx = Math.floor(info.width / 2);
  const cy = Math.floor(info.height / 2);
  let best: [number, number, number] = INK;
  for (let y = cy - 10; y <= cy + 10; y++)
    for (let x = cx - 10; x <= cx + 10; x++) {
      const i = (y * info.width + x) * info.channels;
      const px: [number, number, number] = [data[i], data[i + 1], data[i + 2]];
      if (distance(px, INK) > distance(best, INK)) best = px;
    }
  return best;
}

async function expectSceneRenders(page: Page, url: string) {
  const errors = collectErrors(page);
  await page.goto(url);
  await expect(page.locator("canvas")).toHaveCount(1);
  await page.waitForSelector('canvas[data-canyon][data-state="running"]', { timeout: 30_000 });
  await page.waitForTimeout(3000);
  const px = await centrePixel(page);
  expect(distance(px, INK), `centre pixel ${px.join(",")}`).toBeGreaterThan(6);
  expect(errors).toEqual([]);
}

test.use({ viewport: { width: 1440, height: 900 } });

test("canvas renders without errors", async ({ page }) => {
  await expectSceneRenders(page, "/");
});

test("reduced motion still renders", async ({ page }) => {
  await expectSceneRenders(page, "/?rm");
});

test("no WebGL2 shows the poster", async ({ page }) => {
  await page.addInitScript(() => {
    HTMLCanvasElement.prototype.getContext = (() => null) as typeof HTMLCanvasElement.prototype.getContext;
  });
  await page.goto("/");
  await expect(page.locator("html")).toHaveClass(/(^|\s)no-gl(\s|$)/);
  await expect(page.getByTestId("canyon-poster")).toBeVisible();
});
