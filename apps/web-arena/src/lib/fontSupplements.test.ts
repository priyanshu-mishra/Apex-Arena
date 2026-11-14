import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { FONT_SUPPLEMENTS, fontSupplementCss } from "./fontSupplements";

const PUBLIC = join(__dirname, "..", "..", "public");
const urls = (css: string) => [...css.matchAll(/url\("([^"]+)"\)/g)].map((m) => m[1]);

describe("font supplements", () => {
  it("resolve under the base path (GitHub Pages serves under /Apex-Arena)", () => {
    const found = urls(fontSupplementCss("/Apex-Arena"));
    expect(found).toEqual(FONT_SUPPLEMENTS.map((f) => `/Apex-Arena/fonts/${f.file}`));
  });

  it("resolve at the root without a base path, to files that exist", () => {
    const found = urls(fontSupplementCss(""));
    expect(found).toEqual(FONT_SUPPLEMENTS.map((f) => `/fonts/${f.file}`));
    for (const u of found) expect(existsSync(join(PUBLIC, u))).toBe(true);
    expect(urls(fontSupplementCss("/Apex-Arena/"))[0]).toBe("/Apex-Arena/fonts/archivo-symbols.woff2");
  });

  it("are never declared with a root-absolute URL in the stylesheet", () => {
    const css = readFileSync(join(__dirname, "..", "app", "globals.css"), "utf8");
    expect(css).not.toMatch(/url\(["']?\/fonts\//);
    // The stacks still lead with the supplements.
    for (const f of FONT_SUPPLEMENTS) expect(css).toContain(`"${f.family}"`);
  });
});
