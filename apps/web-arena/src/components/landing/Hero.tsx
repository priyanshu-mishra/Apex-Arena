"use client";

import Link from "next/link";
import { CHAPTER_VH, COPY } from "@/content/landing";
import { useCanyon } from "@/lib/canyon/store";
import { cn } from "@/lib/utils";
import s from "./landing.module.css";
import { Rich } from "./Rich";
import { Stage } from "./Stage";
import { TitleLines } from "./TitleLines";

const c = COPY.c0;

/** 00 The market: film-title headline over the canyon floor. */
export function Hero() {
  return (
    <Stage id={c.id} variant="b" heightVh={CHAPTER_VH.c0} stageClassName={s.heroStage}>
      <div className={s.heroTitle}>
        <h1 className={s.h1}>
          <TitleLines lines={c.titleLines} />
        </h1>
        <p className={s.lede} data-rv="">
          {c.lede}
        </p>
        <div className={s.acts} data-rv="">
          <Link className={cn(s.btn, s.pri, s.lg)} href="/enter">
            {c.enter}
          </Link>
          <button
            className={cn(s.btn, s.ghost, s.lg)}
            type="button"
            onClick={() => useCanyon.getState().setMood("crash")}
          >
            <i className={s.dot} aria-hidden="true" />
            {c.crash}
          </button>
        </div>
        <p className={s.precise} data-precise="">
          <Rich text={c.precise} />
        </p>
      </div>
    </Stage>
  );
}
