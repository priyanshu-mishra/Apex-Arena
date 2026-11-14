import { describe, expect, it } from "vitest";
import * as kit from "./kit";

describe("kit.range", () => {
  it("draws the landing order control's 14×28 thumb on a 28px input", () => {
    for (const thumb of ["&::-webkit-slider-thumb", "&::-moz-range-thumb"]) {
      expect(kit.range).toContain(`[${thumb}]:w-[14px]`);
      expect(kit.range).toContain(`[${thumb}]:h-[28px]`);
    }
    // Centred on the 1px track, as landing.module.css .range does.
    expect(kit.range).toContain("[&::-webkit-slider-thumb]:-mt-[14px]");
    expect(kit.range).toMatch(/^h-\[28px\] /);
    expect(kit.range).not.toMatch(/\[(10|22)px\]/);
  });
});
