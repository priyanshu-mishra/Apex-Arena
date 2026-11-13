import { describe, expect, it } from "vitest";
import { DEFAULT_DENSITY, DENSITY_KEY, parseDensity, readDensity } from "./density";

describe("density", () => {
  it("density defaults to simple", () => {
    expect(DEFAULT_DENSITY).toBe("simple");
    // No window / localStorage in this environment: the server render sees Simple.
    expect(readDensity()).toBe("simple");
    expect(parseDensity(null)).toBe("simple");
    expect(parseDensity("")).toBe("simple");
    expect(parseDensity("expert")).toBe("simple");
  });

  it("reads a saved Pro choice from localStorage['apex-density']", () => {
    expect(DENSITY_KEY).toBe("apex-density");
    expect(parseDensity("pro")).toBe("pro");
    const storage = { getItem: (k: string) => (k === "apex-density" ? "pro" : null) };
    expect(readDensity(storage)).toBe("pro");
  });

  it("falls back to simple when storage is blocked", () => {
    const blocked = {
      getItem: () => {
        throw new Error("SecurityError");
      },
    };
    expect(readDensity(blocked)).toBe("simple");
  });
});
