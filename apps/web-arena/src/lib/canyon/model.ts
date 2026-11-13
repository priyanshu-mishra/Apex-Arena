/** Canyon market model, ported from the landing prototype (mirrored in GLSL). */
export const SPAN = 24;
export const LEN = 64;
export const W = 7;
export const NL = 14;
export const NEV = 8;

export type MarketEvent = { t: number; mag: number; dir: -1 | 1 };

export const midBase = (t: number): number =>
  0.9 * Math.sin(t * 0.13) +
  0.5 * Math.sin(t * 0.31 + 1.3) +
  0.22 * Math.sin(t * 0.83 + 0.7) +
  0.07 * Math.sin(t * 2.1 + 2.0);

export function market(
  tau: number,
  events: readonly MarketEvent[],
): { cx: number; hs: number; sh: number } {
  let cx = midBase(tau);
  let hs = 0.16;
  let sh = 0;
  for (const e of events) {
    const dt = tau - e.t;
    if (dt > 0 && e.mag > 0) {
      cx += e.dir * e.mag * 2.6 * (1 - Math.exp(-dt * 5)) * (0.4 + 0.6 * Math.exp(-dt * 0.22));
      const s = e.mag * Math.exp(-dt * 0.55);
      sh += s;
      hs += s * 1.5 * (1 - Math.exp(-dt * 9));
    }
  }
  return { cx, hs, sh };
}

export const lvl = (l: number, tau: number, side: -1 | 1): number =>
  3.6 * Math.pow(l / NL, 1.3) * (0.85 + 0.15 * Math.sin(tau * 0.55 + side * 1.9 + l * 0.3));

/** Hawkes-style intensity: 0.20 baseline plus decaying contributions from past shocks. */
export function lambda(tau: number, events: readonly MarketEvent[]): number {
  let l = 0.2;
  for (const e of events) {
    const dt = tau - e.t;
    if (dt > 0) l += e.mag * 2.3 * Math.exp(-0.55 * dt);
  }
  return l;
}
