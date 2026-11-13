import { expect, test, type Page } from "@playwright/test";

const LINES = ["Seed 42 planted", "Order book and pool open", "Four agents awake. You make five."];

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(e.message));
  return errors;
}

/** Every boot line reads "done" (the word is always in the DOM; it shows only when lit). */
async function expectAllDone(page: Page) {
  const lines = page.getByRole("list", { name: "Start-up steps" }).getByRole("listitem");
  await expect(lines).toHaveCount(3);
  for (const [i, text] of LINES.entries()) {
    const li = lines.nth(i);
    await expect(li).toContainText(text);
    await expect(li).toHaveAttribute("data-state", "done");
    await expect(li.getByText("done", { exact: true })).toHaveCSS("opacity", "1");
  }
}

async function expectEntry(page: Page) {
  const guest = page.getByRole("link", { name: "Continue as guest" });
  await expect(guest).toBeFocused();
  await expect(guest).toHaveAttribute("href", "/app");
  await expect(page.getByRole("button", { name: "Sign in (coming soon)" })).toBeDisabled();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("The arena is open.");
  await expect(page.getByText("No account needed. Accounts arrive with hosting.")).toBeVisible();
  await expect(page.getByTestId("gate-state")).toHaveText("open");
  await expectAllDone(page);
}

test.use({ viewport: { width: 1440, height: 900 } });

test("gate boots then offers entry", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto("/enter");
  await expect(page.getByRole("link", { name: "Back to the overview", exact: true })).toHaveAttribute("href", "/");
  // The 2.6 s boot starts once the scene is up.
  await page.waitForSelector('canvas[data-canyon="gate"][data-state="running"]', { timeout: 30_000 });
  await expect(page.getByTestId("gate-state")).toHaveText("starting");
  await page.waitForTimeout(3000);
  await expectEntry(page);
  // The seed numeral has lifted away; the camera has landed in the hero framing.
  await expect(page.getByTestId("gate-seed")).toHaveCSS("opacity", "0");
  expect(errors).toEqual([]);
});

test("gate reduced motion", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto("/enter?rm");
  // Final state at once: no boot, no seed numeral.
  await expect(page.getByRole("link", { name: "Continue as guest" })).toBeFocused({ timeout: 1500 });
  await expectEntry(page);
  await expect(page.getByTestId("gate-seed")).toBeHidden();
  expect(errors).toEqual([]);
});

test("gate honours prefers-reduced-motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/enter");
  await expect(page.getByRole("link", { name: "Continue as guest" })).toBeFocused({ timeout: 1500 });
  await expectEntry(page);
  await expect(page.getByTestId("gate-seed")).toBeHidden();
});

test("landing and gate swap scenes without leaking WebGL contexts", async ({ page }) => {
  const errors = collectErrors(page);
  // Record every WebGL2 context so we can count the ones still alive.
  await page.addInitScript(() => {
    const w = window as Window & { __gl?: WebGL2RenderingContext[] };
    w.__gl = [];
    const orig = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, ...rest: unknown[]) {
      const ctx = (orig as (...a: unknown[]) => unknown).call(this, type, ...rest);
      if (type === "webgl2" && ctx && !w.__gl!.includes(ctx as WebGL2RenderingContext))
        w.__gl!.push(ctx as WebGL2RenderingContext);
      return ctx;
    } as typeof HTMLCanvasElement.prototype.getContext;
  });
  const liveContexts = () =>
    page.evaluate(
      () => (window as Window & { __gl?: WebGL2RenderingContext[] }).__gl!.filter((c) => !c.isContextLost()).length,
    );
  const expectOneScene = async (mode: "landing" | "gate") => {
    await expect(page.locator(`canvas[data-canyon="${mode}"][data-state="running"]`)).toHaveCount(1, { timeout: 30_000 });
    await expect(page.locator("canvas[data-canyon]")).toHaveCount(1);
    await expect.poll(liveContexts).toBe(1);
  };

  await page.goto("/");
  await expectOneScene("landing");
  // A marker that survives only client-side navigation.
  await page.evaluate(() => ((window as Window & { __spa?: number }).__spa = 1));

  await page.getByRole("banner").getByRole("link", { name: "Enter the arena" }).click();
  await expect(page).toHaveURL(/\/enter$/);
  await expectOneScene("gate");

  await page.getByRole("link", { name: "Back to the overview", exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  await expectOneScene("landing");

  await page.getByRole("banner").getByRole("link", { name: "Enter the arena" }).click();
  await expect(page).toHaveURL(/\/enter$/);
  await expectOneScene("gate");

  expect(await page.evaluate(() => (window as Window & { __spa?: number }).__spa)).toBe(1);
  expect(errors).toEqual([]);
});
