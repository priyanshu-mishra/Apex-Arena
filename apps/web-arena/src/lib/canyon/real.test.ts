import { describe, expect, it } from "vitest";
import snapshot from "./__fixtures__/snapshot.json";
import verify from "./__fixtures__/verify.json";
import { parseTui } from "./real";

describe("parseTui", () => {
  it("reads the ledger values", () => {
    const r = parseTui(snapshot, verify);
    expect(r.hash).toBe("4ee5fa377dd4d01d6225c6dd5f4f8f7a2d9cda7db63319e71f3d1c1458725614");
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
