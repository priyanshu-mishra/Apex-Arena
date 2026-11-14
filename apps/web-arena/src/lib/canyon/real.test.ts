import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import snapshot from "./__fixtures__/snapshot.json";
import verify from "./__fixtures__/verify.json";
import { AGENTS } from "./cast";
import { ORDER_MAX_ETH } from "./ladder";
import { PROOF_RUNS, proofRefusal } from "./parse";
import { REAL, parseTui, realAcs, runMatches } from "./real";
import { BASE_MID, INITIAL_STATUS } from "./status";

describe("parseTui", () => {
  it("reads the ledger values", () => {
    const r = parseTui(snapshot, verify);
    expect(r.hash).toBe("4ee5fa377dd4d01d6225c6dd5f4f8f7a2d9cda7db63319e71f3d1c1458725614");
    expect(r.hashes).toEqual(verify.hashes);
    expect(r.hashesEqual).toBe(true);
    expect(r.mid).toBeCloseTo(2142.31, 2);
    expect(r.asks).toHaveLength(7);
    expect(r.asks[0][0]).toBeCloseTo(2142.69, 2);
    expect(r.asks[0][1]).toBeCloseTo(1.858, 3);
    expect(r.leaderboard.map((a) => a.agentId)).toEqual(["Gemini-2.5", "DeepSeek-R1", "Hawkes-HFT", "MM-Alpha"]);
    expect(r.leaderboard.map((a) => Number(a.acs.toFixed(3)))).toEqual([0.883, 0.881, 0.234, 0]);
    expect(r.leaderboard[3].liquidated).toBe(true);
    expect(r.leaderboard[0].role).toBe("reasoning agent");
    expect(r.leaderboard[2].role).toBe("quant algorithm");
    expect(r.leaderboard[3].role).toBe("liquidated at the 5% margin limit");
    expect(r.lambdaCalm).toBe(0.2);
  });

  it("uses the calm run for lambda when given", () => {
    expect(parseTui(snapshot, verify, { hawkes_intensity_pips: 21169262 }).lambdaCalm).toBeCloseTo(0.2117, 4);
  });

  it("rejects malformed input", () => {
    expect(() => parseTui({}, {})).toThrow();
  });
});

const H = "4ee5fa377dd4d01d6225c6dd5f4f8f7a2d9cda7db63319e71f3d1c1458725614";
const other = "0".repeat(64);

describe("proofRefusal (gen:real writes only a proven run)", () => {
  it("accepts all_equal with five identical hashes", () => {
    expect(proofRefusal(verify)).toBeNull();
  });
  it("refuses when all_equal is false", () => {
    expect(proofRefusal({ ...verify, all_equal: false })).toMatch(/all_equal/);
  });
  it("refuses when a hash differs, even if all_equal claims otherwise", () => {
    expect(proofRefusal({ all_equal: true, hashes: [H, H, other, H, H] })).toMatch(/not identical/);
  });
  it("refuses fewer or more than five hashes", () => {
    expect(proofRefusal({ all_equal: true, hashes: [H, H, H, H] })).toMatch(/5 hashes/);
    expect(proofRefusal({ all_equal: true, hashes: [H, H, H, H, H, H] })).toMatch(/5 hashes/);
    expect(proofRefusal({ all_equal: true })).toMatch(/5 hashes/);
    expect(proofRefusal(null)).not.toBeNull();
  });
});

describe("runMatches", () => {
  it("marks each run against run 1", () => {
    expect(runMatches([H, H, other, H])).toEqual([true, true, false, true]);
  });
});

describe("the shipped REAL (real.json)", () => {
  it("is a proven five-run determinism check", () => {
    expect(REAL.hashesEqual).toBe(true);
    expect(REAL.hashes).toHaveLength(PROOF_RUNS);
    expect(new Set(REAL.hashes).size).toBe(1);
    expect(REAL.hashes[0]).toBe(REAL.hash);
    expect(REAL.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(runMatches(REAL.hashes).every(Boolean)).toBe(true);
  });

  it("holds the seven-level ask ladder the order control walks to its maximum", () => {
    expect(REAL.asks).toHaveLength(7);
    const total = REAL.asks.reduce((sum, [, size]) => sum + size, 0);
    expect(total).toBeGreaterThanOrEqual(ORDER_MAX_ETH);
    expect(ORDER_MAX_ETH).toBe(45);
  });

  it("names every agent the scene casts by string", () => {
    const ids = REAL.leaderboard.map((r) => r.agentId);
    for (const name of ["Gemini-2.5", "DeepSeek-R1", "Hawkes-HFT", "MM-Alpha"]) expect(ids).toContain(name);
    for (const a of AGENTS.slice(0, 4)) expect(() => realAcs(a.name)).not.toThrow();
  });

  it("makes the scene's agent lookup fail loudly outside production", () => {
    expect(() => realAcs("Nobody-1")).toThrow(/no leaderboard row for "Nobody-1"/);
    expect(realAcs("Gemini-2.5")).toBeCloseTo(0.883, 3);
  });
});

describe("the scene's base price", () => {
  it("is the engine's mid, so one ETH price shows on the page", () => {
    expect(BASE_MID).toBe(REAL.mid);
    expect(INITIAL_STATUS.mid).toBe(REAL.mid);
    expect(INITIAL_STATUS.pool).toBe(REAL.mid);
    expect(INITIAL_STATUS.tick).toBe(0);
    expect(INITIAL_STATUS.regime).toBe("calm");
  });

  it("is not hard-coded anywhere the landing reads it", () => {
    const src = join(__dirname, "..", "..");
    for (const f of [
      "lib/canyon/scene.ts",
      "components/landing/StatusLine.tsx",
      "components/landing/VenueReadouts.tsx",
    ]) {
      const text = readFileSync(join(src, f), "utf8");
      expect(text, f).not.toMatch(/2241\.5|2236\.1/);
    }
  });
});
