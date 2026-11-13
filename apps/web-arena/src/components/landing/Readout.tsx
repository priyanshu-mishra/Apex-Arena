import type { ReactNode, Ref } from "react";
import { cn } from "@/lib/utils";
import s from "./landing.module.css";

export type ReadoutTone = "up" | "dn" | "pl" | "am";
const TONE: Record<ReadoutTone, string> = { up: s.up, dn: s.dn, pl: s.pl, am: s.am };

/**
 * Instrument readout: caption (sans), big numeral (mono), sub-line (mono).
 * No box. Live values are written through `valueRef` / `subRef`, not React state.
 */
export function Readout({
  k,
  v,
  sub,
  tone,
  className,
  valueRef,
  subRef,
}: {
  k: string;
  v: ReactNode;
  sub?: ReactNode;
  tone?: ReadoutTone;
  className?: string;
  valueRef?: Ref<HTMLSpanElement>;
  subRef?: Ref<HTMLSpanElement>;
}) {
  return (
    <div className={cn(s.read, className)}>
      <span className={s.readK}>{k}</span>
      <span ref={valueRef} className={cn(s.readV, tone && TONE[tone])}>
        {v}
      </span>
      {sub !== undefined ? (
        <span ref={subRef} className={s.readS}>
          {sub}
        </span>
      ) : null}
    </div>
  );
}
