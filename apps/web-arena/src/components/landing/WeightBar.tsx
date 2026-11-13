import { COPY } from "@/content/landing";

/** Segment fills for 40 / 30 / 20 / −10 (churn in vermilion). */
const SEG = ["bg-bone", "bg-bone opacity-70", "bg-bone opacity-45", "bg-ask"] as const;
const WEIGHTS = COPY.c5.weights.map((w, i) => ({ ...w, seg: SEG[i] }));

const GRID = "grid grid-cols-[40fr_30fr_20fr_10fr] gap-[2px]";

/**
 * The Apex score's weights as one bar: 40 / 30 / 20 / 10 segments
 * (churn in vermilion) with a mono figure and a caption under each.
 */
export function WeightBar() {
  return (
    <div>
      <div className={`${GRID} mt-[22px] h-[5px]`} aria-hidden="true">
        {WEIGHTS.map((w) => (
          <i key={w.pct} className={w.seg} />
        ))}
      </div>
      <div className={`${GRID} mt-2 font-sans text-[12px] leading-[1.25] text-bone-2`}>
        {WEIGHTS.map((w) => (
          <span key={w.pct}>
            <b className="block font-mono text-[12px] leading-[1.4] font-medium text-bone">{w.pct}</b>
            {w.label}
          </span>
        ))}
      </div>
    </div>
  );
}
