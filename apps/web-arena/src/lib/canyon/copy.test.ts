import { describe, expect, it } from "vitest";
import { COPY_DIM, COPY_FEATHER, MAX_COPY, copyMaskAt } from "./copy";
import { COPY_MASK, FS_LINE, FS_POINT_LINE, GATE_NODE_FS, NODE_FS } from "./shaders";

const box = { l: 100, t: 100, r: 300, b: 200 };

describe("copy mask", () => {
  it("dims inside a copy box and leaves the rest alone", () => {
    expect(copyMaskAt([box], 200, 150)).toBeCloseTo(COPY_DIM);
    expect(copyMaskAt([box], 100, 100)).toBeCloseTo(COPY_DIM);
    expect(copyMaskAt([box], 300 + COPY_FEATHER, 150)).toBe(1);
    expect(copyMaskAt([box], 600, 600)).toBe(1);
    expect(copyMaskAt([], 200, 150)).toBe(1);
  });

  it("ramps smoothly across the feather", () => {
    const half = copyMaskAt([box], 300 + COPY_FEATHER / 2, 150);
    expect(half).toBeGreaterThan(COPY_DIM);
    expect(half).toBeLessThan(1);
    expect(copyMaskAt([box], 300 + COPY_FEATHER / 4, 150)).toBeLessThan(half);
  });

  it("reads at most MAX_COPY boxes, like the shader", () => {
    const far = Array.from({ length: MAX_COPY }, () => ({ l: -50, t: -50, r: -40, b: -40 }));
    expect(copyMaskAt([...far, box], 200, 150)).toBe(1);
    expect(COPY_MASK).toContain(`uTextR[${MAX_COPY}]`);
  });

  it("is applied by the node, wire and line shaders", () => {
    for (const fs of [FS_LINE, FS_POINT_LINE, NODE_FS, GATE_NODE_FS]) expect(fs).toMatch(/textMask\(\)/);
  });
});
