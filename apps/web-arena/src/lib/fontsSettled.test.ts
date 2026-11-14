import { describe, expect, it, vi } from "vitest";
import { onFontsSettled } from "./fontsSettled";

function fakeFonts() {
  let resolve!: () => void;
  const ready = new Promise<void>((r) => (resolve = () => r()));
  const listeners = new Set<() => void>();
  const fonts = {
    ready,
    addEventListener: (_: string, fn: () => void) => listeners.add(fn),
    removeEventListener: (_: string, fn: () => void) => listeners.delete(fn),
  } as unknown as FontFaceSet;
  return { fonts, resolve: () => resolve(), loadingDone: () => listeners.forEach((fn) => fn()), listeners };
}

describe("onFontsSettled", () => {
  it("fires once document.fonts.ready resolves, and on later loads", async () => {
    const f = fakeFonts();
    const cb = vi.fn();
    onFontsSettled(cb, f.fonts);
    expect(cb).not.toHaveBeenCalled();
    f.resolve();
    await f.fonts.ready;
    await Promise.resolve();
    expect(cb).toHaveBeenCalledTimes(1);
    f.loadingDone();
    expect(cb).toHaveBeenCalledTimes(2);
  });

  it("stays quiet after cancel", async () => {
    const f = fakeFonts();
    const cb = vi.fn();
    const cancel = onFontsSettled(cb, f.fonts);
    cancel();
    f.resolve();
    await f.fonts.ready;
    await Promise.resolve();
    f.loadingDone();
    expect(cb).not.toHaveBeenCalled();
    expect(f.listeners.size).toBe(0);
  });

  it("is a no-op without a FontFaceSet (server render)", () => {
    expect(() => onFontsSettled(() => {}, undefined)()).not.toThrow();
  });
});
