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
  // One scene canvas (chapter 03's λ trace is a separate 2D canvas).
  await expect(page.locator("canvas[data-canyon]")).toHaveCount(1);
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

/** Scene labels that are showing, and whether each sits inside the viewport and off the chapter copy. */
async function labelReport(page: Page, chapter: string) {
  return page.evaluate((ch) => {
    const copy = Array.from(document.querySelectorAll<HTMLElement>(`#${ch} :is(h1, h2, p), header, [role='status'], [data-shield]`))
      .map((el) => el.getBoundingClientRect())
      .filter((r) => r.width > 0 && r.height > 0);
    const layer = document.querySelector("div[aria-hidden='true'].fixed.inset-0");
    return Array.from(layer?.children ?? [])
      .filter((el) => Number(getComputedStyle(el).opacity) > 0.3)
      .map((el) => {
        const r = el.getBoundingClientRect();
        const crosses = copy.some((c) => r.left < c.right && r.right > c.left && r.top < c.bottom && r.bottom > c.top);
        return { text: el.textContent, inside: r.left >= 0 && r.right <= innerWidth, crosses };
      });
  }, chapter);
}

test.describe("scene labels", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("stay off the copy at 1280×800", async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector('canvas[data-canyon][data-state="running"]', { timeout: 30_000 });
    await page.evaluate(() => {
      const el = document.getElementById("c2")!;
      window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY + (el.offsetHeight - window.innerHeight) * 0.45);
    });
    await page.waitForTimeout(2500);
    const labels = await labelReport(page, "c2");
    expect(labels.length).toBeGreaterThan(0);
    expect(labels.filter((l) => l.crosses || !l.inside)).toEqual([]);
  });
});

test.describe("scene labels on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test("are never cut by the screen edge, before or after rotating", async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector('canvas[data-canyon][data-state="running"]', { timeout: 30_000 });
    await page.waitForTimeout(2500);
    expect((await labelReport(page, "c0")).filter((l) => l.crosses || !l.inside)).toEqual([]);

    await page.setViewportSize({ width: 844, height: 390 });
    await page.waitForTimeout(2500);
    const chapter = await page.evaluate(() => document.querySelector("nav[aria-label='Chapters'] a[aria-current]")!.getAttribute("href")!.slice(1));
    expect((await labelReport(page, chapter)).filter((l) => l.crosses || !l.inside)).toEqual([]);
  });
});

type Box = { l: number; t: number; r: number; b: number };
type SceneProbe = { textBoxes: Box[]; setCopySource(s: unknown): void };
type ProbeWindow = Window & { __canyonState?: () => { scene: SceneProbe | null } };

/**
 * Renders the same still frame (reduced motion) with the copy mask on and
 * then off, canvas only, and compares them: `removed` counts pixels inside the
 * copy boxes that only the unmasked frame lights (lines and nodes behind the
 * copy), `leaked` counts pixels that changed away from the copy.
 */
async function lightBehindCopy(page: Page) {
  const boxes = await page.evaluate(() => {
    const scene = (window as ProbeWindow).__canyonState!().scene!;
    return scene.textBoxes.map((b) => ({ ...b }));
  });
  await page.addStyleTag({
    content: "body * { visibility: hidden !important; } canvas[data-canyon] { visibility: visible !important; }",
  });
  await page.waitForTimeout(300);
  const shot = async () => sharp(await page.screenshot()).raw().toBuffer({ resolveWithObject: true });
  const masked = await shot();
  await page.evaluate(() => (window as ProbeWindow).__canyonState!().scene!.setCopySource(null));
  await page.waitForTimeout(400);
  const bare = await shot();
  const { width, height, channels } = masked.info;
  const k = width / (page.viewportSize()?.width ?? width);
  const inBox = (x: number, y: number, grow: number) =>
    boxes.some((b) => x >= (b.l - grow) * k && x < (b.r + grow) * k && y >= (b.t - grow) * k && y < (b.b + grow) * k);
  let removed = 0;
  let leaked = 0;
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * channels;
      const d = bare.data[i] + bare.data[i + 1] + bare.data[i + 2] - (masked.data[i] + masked.data[i + 1] + masked.data[i + 2]);
      if (Math.abs(d) < 45) continue;
      if (inBox(x, y, 0)) removed += d > 0 ? 1 : 0;
      else if (!inBox(x, y, 18)) leaked++;
    }
  return { boxes: boxes.length, removed, leaked };
}

async function scrollTo(page: Page, id: string, p: number) {
  await page.evaluate(
    ([sel, prog]) => {
      const el = document.getElementById(sel as string)!;
      const top = el.getBoundingClientRect().top + window.scrollY;
      window.scrollTo(0, Math.round(top + (el.offsetHeight - window.innerHeight) * (prog as number)));
    },
    [id, p] as const,
  );
}

test.describe("nodes and wires dim behind the copy", () => {
  for (const [id, p] of [["c4", 0.5], ["c5", 0.5]] as const) {
    test(`chapter ${id}`, async ({ page }) => {
      await page.goto("/?rm");
      await page.waitForSelector('canvas[data-canyon][data-state="running"]', { timeout: 30_000 });
      await scrollTo(page, id, p);
      await page.waitForTimeout(1200);
      const light = await lightBehindCopy(page);
      expect(light.boxes).toBeGreaterThan(0);
      // Unmasked, the scene's lines and nodes cross the copy; masked they drop away there, and only there.
      expect(light.removed, JSON.stringify(light)).toBeGreaterThan(100);
      expect(light.leaked, JSON.stringify(light)).toBe(0);
    });
  }

  test("the hero keeps its approved first viewport", async ({ page }) => {
    await page.goto("/?rm");
    await page.waitForSelector('canvas[data-canyon][data-state="running"]', { timeout: 30_000 });
    await page.waitForTimeout(500);
    const n = await page.evaluate(() => (window as ProbeWindow).__canyonState!().scene!.textBoxes.length);
    expect(n).toBe(0);
  });
});

test.describe("the gate's stair line on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test("dims behind the start-up steps", async ({ page }) => {
    await page.goto("/enter?rm");
    await page.waitForSelector('canvas[data-canyon="gate"][data-state="running"]', { timeout: 30_000 });
    await page.waitForTimeout(1200);
    const light = await lightBehindCopy(page);
    expect(light.boxes).toBeGreaterThanOrEqual(3);
    expect(light.removed, JSON.stringify(light)).toBeGreaterThan(100);
    expect(light.leaked, JSON.stringify(light)).toBe(0);
  });
});
