import { describe, expect, it } from "vitest";
import { createDprGovernor, shouldDropDpr, stepDprGovernor } from "./dprGovernor";

const frames = (ms: number, count: number) => Array.from({ length: count }, () => ms);

describe("dprGovernor", () => {
  it("does not drop for one 500 ms warm-up hitch followed by steady 60 fps", () => {
    expect(shouldDropDpr([500, ...frames(16.7, 600)])).toBe(false);
  });

  it("does not drop for a lone outlier frame after warm-up", () => {
    expect(shouldDropDpr([...frames(16.7, 120), 600, ...frames(16.7, 300)])).toBe(false);
  });

  it("drops for a sustained 30 ms average after warm-up", () => {
    expect(shouldDropDpr([...frames(16.7, 60), ...frames(30, 120)])).toBe(true);
  });

  it("reports the drop on the frame that closes a slow window", () => {
    const g = createDprGovernor();
    const results = [...frames(16.7, 60), ...frames(30, 120)].map((ms) => stepDprGovernor(g, ms));
    expect(results.indexOf(true)).toBeGreaterThan(60);
  });
});
