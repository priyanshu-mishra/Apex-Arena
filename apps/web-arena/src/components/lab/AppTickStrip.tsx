"use client";

import { memo } from "react";
import { cn } from "../../lib/utils";
import { mono12 } from "../ui/kit";
import { TICKS_PER_EPOCH } from "./model";

const pad = (n: number) => String(n).padStart(3, "0");

/**
 * The landing's tick strip (guide §5), driven by the live worker clock:
 * 100 hairlines (every tenth taller), lit up to the current fast tick, and
 * the clock line "fast clock 042 / 100 ticks … 10 ms each". At the barrier
 * (tick 0 of an epoch) the amber "market held" note shows.
 */
export const AppTickStrip = memo(function AppTickStrip({ pos, held }: { pos: number; held: boolean }) {
  return (
    <div className="flex min-w-0 flex-col gap-2.5">
      <div className="grid h-[26px] grid-cols-[repeat(100,minmax(0,1fr))] items-end" aria-hidden>
        {Array.from({ length: TICKS_PER_EPOCH }, (_, i) => {
          const on = i <= pos;
          const tall = i % 10 === 0;
          return (
            <i
              key={i}
              className={cn(
                "border-l",
                on ? "border-bone opacity-100" : "border-bone-3 opacity-50",
                on ? (tall ? "h-[26px]" : "h-[18px]") : tall ? "h-[14px]" : "h-[8px]",
              )}
            />
          );
        })}
      </div>
      <div className={cn(mono12, "flex flex-wrap justify-between gap-x-4 text-bone-2")}>
        <span>
          fast clock <b className="font-medium text-bone">{pad(pos)}</b> / 100 ticks
        </span>
        <span className={cn("text-shock transition-opacity duration-300", held ? "opacity-100" : "opacity-0")} aria-hidden={!held}>
          market held · thinking agents answer
        </span>
        <span>10 ms each</span>
      </div>
    </div>
  );
});
