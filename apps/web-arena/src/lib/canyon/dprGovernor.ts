/**
 * Decides when the Canyon scene should drop its pixel ratio to 1.25: when a
 * 2 s window of frames averages over 22 ms. Load jank (shader compile, buffer
 * upload, hydration) is ignored: nothing is measured during the first second,
 * and single frames over 250 ms are left out of the average.
 */
export const DPR_WARMUP_MS = 1000;
export const DPR_OUTLIER_MS = 250;
export const DPR_WINDOW_MS = 2000;
export const DPR_SLOW_MS = 22;

export type DprGovernor = { elapsed: number; ms: number; n: number };

export const createDprGovernor = (): DprGovernor => ({ elapsed: 0, ms: 0, n: 0 });

/** Feed one frame time (ms); returns true when the window just closed slow. */
export function stepDprGovernor(g: DprGovernor, frameMs: number): boolean {
  if (!(frameMs > 0)) return false;
  g.elapsed += frameMs;
  if (g.elapsed <= DPR_WARMUP_MS || frameMs > DPR_OUTLIER_MS) return false;
  g.ms += frameMs;
  g.n++;
  if (g.ms < DPR_WINDOW_MS) return false;
  const avg = g.ms / g.n;
  g.ms = 0;
  g.n = 0;
  return avg > DPR_SLOW_MS;
}

/** Pure check over a sequence of frame times: would the governor ever drop? */
export function shouldDropDpr(frameTimes: readonly number[]): boolean {
  const g = createDprGovernor();
  for (const ms of frameTimes) if (stepDprGovernor(g, ms)) return true;
  return false;
}
