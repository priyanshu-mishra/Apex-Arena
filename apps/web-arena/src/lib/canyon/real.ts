import real from "./real.json";
import type { RealData } from "./parse";

export { parseTui, runMatches } from "./parse";
export type { RealData } from "./parse";

export const REAL: RealData = real as RealData;

/**
 * An agent's real ACS, looked up by the name the scene casts it under. A name
 * missing from real.json throws outside production (so a renamed agent cannot
 * silently score 0); a production build logs it and draws 0.
 */
export function realAcs(agentId: string, real: RealData = REAL): number {
  const row = real.leaderboard.find((r) => r.agentId === agentId);
  if (row) return row.acs;
  const msg = `real.json has no leaderboard row for "${agentId}"`;
  if (process.env.NODE_ENV !== "production") throw new Error(msg);
  console.error(msg);
  return 0;
}
