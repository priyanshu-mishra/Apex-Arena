export type WalkResult = {
  filled: number;
  avgFill: number;
  impactBps: number;
  levelsCleared: number;
};

/** The landing order control's largest buy (ETH); the real ask ladder must hold at least this much. */
export const ORDER_MAX_ETH = 45;

/** Walk a market buy of `qty` up the ask ladder; impact uses the last touched price. */
export function walkAsks(
  qty: number,
  asks: readonly [number, number][],
  mid: number,
): WalkResult {
  let left = qty;
  let cost = 0;
  let last = asks[0][0];
  let levelsCleared = 0;
  for (const [px, sz] of asks) {
    if (left <= 0) break;
    const take = Math.min(left, sz);
    cost += take * px;
    left -= take;
    last = px;
    if (take >= sz - 1e-9) levelsCleared++;
  }
  const filled = qty - left;
  const avgFill = filled > 0 ? cost / filled : asks[0][0];
  const impactBps = filled > 0 ? ((last - mid) / mid) * 1e4 : 0;
  return { filled, avgFill, impactBps, levelsCleared };
}
