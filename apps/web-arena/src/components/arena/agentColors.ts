import { USER_AGENT_ID } from "../../lib/arena";
import type { PricePointUi } from "../../lib/sharedBuffer";

/** Stable per-agent line colors shared by the chart legend and leaderboard. */
const FIXED: Record<string, string> = {
  [USER_AGENT_ID]: "#10b981",
  "Gemini-2.5": "#a855f7",
  "DeepSeek-R1": "#f472b6",
  "Hawkes-HFT": "#f59e0b",
  "MM-Alpha": "#38bdf8",
};
const EXTRA = ["#e2e8f0", "#facc15", "#2dd4bf", "#818cf8", "#fb923c", "#a3e635"];

export function agentColor(id: string): string {
  if (FIXED[id]) return FIXED[id];
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return EXTRA[h % EXTRA.length];
}

/** Equity per agent at one history point, falling back to the named legacy fields. */
export function pointEquities(p: PricePointUi): Record<string, number> {
  if (p.agentEquities && Object.keys(p.agentEquities).length > 0) return p.agentEquities;
  return {
    [USER_AGENT_ID]: p.userEquityUsd,
    "Gemini-2.5": p.geminiEquityUsd,
    "DeepSeek-R1": p.deepseekEquityUsd,
    "Hawkes-HFT": p.hawkesEquityUsd,
    "MM-Alpha": p.mmAlphaEquityUsd,
  };
}

export const REGIME_COLOR: Record<string, string> = {
  CALM: "#10b981",
  TRENDING: "#38bdf8",
  "LIQUIDITY DROUGHT": "#f59e0b",
  "FLASH CRASH": "#f43f5e",
};

export function regimeLabel(r: string): string {
  return r.charAt(0) + r.slice(1).toLowerCase();
}
