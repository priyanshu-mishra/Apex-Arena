import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";
import s from "./landing.module.css";

export type StageVariant = "l" | "r" | "b" | "c" | "f";

const SCRIM: Record<StageVariant, string> = {
  l: s.scrimL,
  r: s.scrimR,
  b: s.scrimB,
  c: s.scrimC,
  f: s.scrimF,
};

/**
 * One chapter: `section#id` of `heightVh` viewport heights holding a sticky
 * 100svh stage (12-column grid, rows head / free / instruments) with a
 * text-local scrim. Chapters taller than 100vh get +20vh in portrait.
 */
export function Stage({
  id,
  variant,
  heightVh,
  className,
  stageClassName,
  children,
}: {
  id: string;
  variant: StageVariant;
  heightVh: number;
  className?: string;
  stageClassName?: string;
  children?: ReactNode;
}) {
  const tall = heightVh > 100;
  const style = (tall ? { "--h": heightVh } : { height: `${heightVh}vh` }) as CSSProperties;
  return (
    <section
      id={id}
      data-h={heightVh}
      className={cn(s.chapter, tall && s.sticky, className)}
      style={style}
    >
      <div className={cn(s.stage, SCRIM[variant], stageClassName)} data-bar-clip="">
        {children}
      </div>
    </section>
  );
}
