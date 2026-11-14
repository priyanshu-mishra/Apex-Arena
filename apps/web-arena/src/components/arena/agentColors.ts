import { USER_AGENT_ID } from "../../lib/arena";
import type { PricePointUi } from "../../lib/sharedBuffer";

/**
 * Stable per-agent line colours shared by the chart legend and leaderboard.
 * Bone for your desk; the rest are muted, warm-to-cool neutrals plus the
 * pool blue and shock amber (guide §2: no purple anywhere).
 */
const FIXED: Record<string, string> = {
  [USER_AGENT_ID]: "#EDEAE3",
  "Gemini-2.5": "#6C9CFF",
  "DeepSeek-R1": "#D9A07A",
  "Hawkes-HFT": "#FFB020",
  "MM-Alpha": "#7C8794",
};
const EXTRA = ["#A8A69F", "#B9C79A", "#C9B27A", "#8FB3C9", "#C98F7A", "#9FBFB0"];

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

/** Regime band alpha over the chart: calm is clear, shocks run amber (guide §5). */
export const REGIME_BAND_ALPHA: Record<string, number> = {
  CALM: 0,
  TRENDING: 0.06,
  "LIQUIDITY DROUGHT": 0.1,
  "FLASH CRASH": 0.16,
};

export function regimeLabel(r: string): string {
  return r.charAt(0) + r.slice(1).toLowerCase();
}
