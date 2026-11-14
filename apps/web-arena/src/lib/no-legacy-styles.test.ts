import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const SRC = join(__dirname, "..");
/** The app-side component folders that used the old dashboard skin. */
const APP_DIRS = ["arena", "lab", "bench", "arch", "views", "ui"].map((d) => join(SRC, "components", d));

function walk(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)],
  );
}

describe("no legacy styles", () => {
  it("has no CSS modules in the app component folders", () => {
    const modules = APP_DIRS.flatMap(walk).filter((f) => f.endsWith(".module.css"));
    expect(modules.map((f) => f.slice(SRC.length + 1))).toEqual([]);
  });

  it("has deleted the legacy stylesheet and its import", () => {
    expect(existsSync(join(SRC, "styles", "legacy.css"))).toBe(false);
    const layout = readFileSync(join(SRC, "app", "app", "layout.tsx"), "utf8");
    expect(layout).not.toMatch(/legacy\.css/);
  });
});
