import type { MarketRegimeLabel } from "@/lib/sharedBuffer";

/**
 * Shared chrome styles for the app shell, matching the landing's controls
 * (DESIGN_GUIDE §5: 34px ghost buttons, 1px rule-2 outline, 2px radius,
 * Archivo wdth 108; no shadows, no data colours on chrome).
 */
export const ghostButton =
  "inline-flex h-[34px] shrink-0 items-center justify-center gap-2.5 rounded-[2px] border border-rule-2 bg-transparent px-4 font-sans text-[13.5px] leading-none font-semibold whitespace-nowrap text-bone [font-variation-settings:'wdth'_108] transition-colors duration-200 hover:border-bone active:translate-y-px";

/** Small mono key hint (⌘K, 1–4). */
export const keyHint = "font-mono text-[12px] leading-none font-normal text-bone-3 [font-variation-settings:'wdth'_87.5]";

/**
 * How hot each regime runs, 0 (calm haze) to 1 (haze-hot). It sets the
 * header's horizon light, the app's stand-in for the old weather band.
 */
export const REGIME_HEAT: Record<MarketRegimeLabel, number> = {
  CALM: 0,
  TRENDING: 0.35,
  "LIQUIDITY DROUGHT": 0.65,
  "FLASH CRASH": 1,
};

export function horizonColor(regime: MarketRegimeLabel): string {
  const pct = Math.round((REGIME_HEAT[regime] ?? 0) * 100);
  return `color-mix(in srgb, var(--haze-hot) ${pct}%, var(--haze))`;
}

/** The regime as a sentence-case word for the status line. */
export function regimeWord(regime: MarketRegimeLabel): string {
  return regime.toLowerCase();
}
