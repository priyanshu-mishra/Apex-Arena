import { cn } from "@/lib/utils";

/**
 * Shared class strings for the app pages, in the landing's language
 * (DESIGN_GUIDE §2, §5): Archivo for words, Martian Mono wdth 87.5 for
 * numbers, 2px radius, 1px rules, no shadows, no data colours on chrome,
 * 12px text floor.
 */

/** Tabular mono numerals. */
export const num = "font-mono tabular-nums [font-variation-settings:'wdth'_87.5]";
/** Mono readout / identifier at the 12px floor. */
export const mono12 = "font-mono text-[12px] leading-[1.45] tabular-nums [font-variation-settings:'wdth'_87.5]";
/** Short caption line (sans, tertiary). */
export const caption = "font-sans text-[12.5px] leading-[1.45] text-bone-3";
/** Field / readout label (sans, secondary). */
export const label = "font-sans text-[12.5px] leading-[1.3] text-bone-2";
/** Body copy inside panels. */
export const body = "font-sans text-[14px] leading-[1.55] text-bone-2 text-pretty";
/** Page title. */
export const pageTitle =
  "font-sans text-[length:clamp(28px,3.2vw,44px)] leading-[0.98] font-[560] tracking-[-0.03em] text-bone text-balance [font-variation-settings:'wdth'_122]";
/** Page lede. */
export const lede = "max-w-[62ch] font-sans text-[length:clamp(15px,1.15vw,17px)] leading-[1.5] text-bone-2 text-pretty";
/** Section heading inside a panel. */
export const subhead = "font-sans text-[13px] leading-none font-semibold text-bone [font-variation-settings:'wdth'_108]";
/** Big numeral (readouts). */
export const bigNum =
  "font-mono text-[length:clamp(22px,2vw,30px)] leading-none font-medium tracking-[-0.03em] tabular-nums text-bone [font-variation-settings:'wdth'_80]";
/** Empty state. */
export const empty = "px-4 py-6 font-sans text-[13.5px] leading-[1.5] text-bone-3";
/** Code / JSON block. */
export const codeBlock =
  "max-w-full overflow-auto rounded-[2px] border border-rule bg-ink p-3 font-mono text-[12px] leading-[1.6] whitespace-pre text-bone-2 [font-variation-settings:'wdth'_87.5]";
export const codeInline = "font-mono text-[12px] text-bone [font-variation-settings:'wdth'_87.5]";

const BTN_BASE =
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-[2px] font-sans leading-none font-semibold whitespace-nowrap no-underline [font-variation-settings:'wdth'_108] transition-[border-color,background-color,color,transform] duration-200 ease-[cubic-bezier(.2,.7,.1,1)] active:translate-y-px disabled:pointer-events-none disabled:opacity-40";

const BTN_SIZE = {
  sm: "h-[30px] px-3 text-[13px]",
  md: "h-[34px] px-4 text-[13.5px]",
  lg: "h-[52px] px-6 text-[16px]",
} as const;

const BTN_VARIANT = {
  /** Bone fill, ink text. */
  primary: "border border-bone bg-bone text-ink hover:bg-bone/90",
  /** 1px rule-2 outline. */
  ghost: "border border-rule-2 bg-transparent text-bone hover:border-bone aria-pressed:border-bone aria-pressed:bg-bone aria-pressed:text-ink",
  /** Text only. */
  quiet: "border border-transparent bg-transparent text-bone-2 hover:text-bone",
} as const;

export function btn(variant: keyof typeof BTN_VARIANT = "ghost", size: keyof typeof BTN_SIZE = "md", extra?: string) {
  return cn(BTN_BASE, BTN_SIZE[size], BTN_VARIANT[variant], extra);
}

/** Text input / select / textarea. */
export const input =
  "h-[34px] w-full min-w-0 rounded-[2px] border border-rule-2 bg-ink px-3 font-mono text-[13px] text-bone tabular-nums [font-variation-settings:'wdth'_87.5] outline-none transition-colors placeholder:text-bone-3 hover:border-bone-3 focus-visible:border-bone disabled:opacity-50 aria-invalid:border-ask";
export const select = cn(input, "appearance-none bg-[length:10px] bg-[right_10px_center] bg-no-repeat pr-8 font-sans text-[13.5px] [font-variation-settings:'wdth'_100]", "bg-[url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' fill='none' stroke='%23A8A69F' stroke-width='1.2'/%3E%3C/svg%3E\")]");
export const textarea = cn(input, "h-auto py-2 leading-[1.5]");
/** Range input: 1px track, bone 10×22 thumb, 2px radius (landing order control). */
export const range =
  "h-[22px] w-full cursor-pointer appearance-none bg-transparent [&::-webkit-slider-runnable-track]:h-px [&::-webkit-slider-runnable-track]:bg-rule-2 [&::-webkit-slider-thumb]:-mt-[10.5px] [&::-webkit-slider-thumb]:h-[22px] [&::-webkit-slider-thumb]:w-[10px] [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-[2px] [&::-webkit-slider-thumb]:bg-bone [&::-moz-range-track]:h-px [&::-moz-range-track]:bg-rule-2 [&::-moz-range-thumb]:h-[22px] [&::-moz-range-thumb]:w-[10px] [&::-moz-range-thumb]:rounded-[2px] [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-bone";

/** Field wrapper and its label row. */
export const field = "flex min-w-0 flex-col gap-1.5";
export const fieldLabel = "flex items-center justify-between gap-2 font-sans text-[12.5px] leading-[1.3] text-bone-2";

/** Plain table, hairline rows (landing leaderboard language). */
export const table = "w-full border-collapse font-sans text-[13px] tabular-nums";
export const th =
  "border-b border-rule-2 px-3 pb-2.5 pt-3 text-left align-bottom font-sans text-[12px] leading-[1.2] font-normal whitespace-nowrap text-bone-2 first:pl-4 last:pr-4";
export const td = "border-b border-rule px-3 py-2.5 align-baseline text-bone-2 first:pl-4 last:pr-4";
export const tdNum = cn(td, num, "text-right whitespace-nowrap text-bone");
export const tableScroll = "max-w-full overflow-x-auto";

/** Data tone → colour (dots, numbers, depth bars only; never chrome). */
export type Tone = "bid" | "ask" | "evm" | "chaos" | "llm" | "regime";
export const TONE: Record<Tone, string> = {
  bid: "var(--bid)",
  ask: "var(--ask)",
  evm: "var(--pool)",
  chaos: "var(--shock)",
  llm: "var(--bone-2)",
  regime: "var(--shock)",
};
export const toneColor = (t: Tone | undefined) => (t ? TONE[t] : "var(--bone-3)");

/** Signed value colour: mint up, vermilion down. */
export const signColor = (v: number) => (v > 0 ? "var(--bid)" : v < 0 ? "var(--ask)" : undefined);

/** Small square data dot (the regime dot of the status line). */
export const dot = "inline-block size-[7px] shrink-0 rounded-[1px]";

/** Page frame: stack of sections. */
export const page = "flex min-w-0 flex-col gap-5 md:gap-6";
