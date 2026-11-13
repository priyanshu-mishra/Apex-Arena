import Link from "next/link";
import { COPY } from "@/content/landing";
import { cn } from "@/lib/utils";
import s from "./landing.module.css";
import { TitleLines } from "./TitleLines";

const c = COPY.c9;

/** 09 Close: giant title, XL primary button, one sentence. */
export function Close() {
  return (
    <section id={c.id} className={cn(s.flow, s.scrimB, s.close)}>
      <h2 className={s.h2}>
        <TitleLines lines={c.titleLines} />
      </h2>
      <div className={s.closeRow} data-rv="">
        <Link className={cn(s.btn, s.pri, s.xl)} href="/enter">
          {c.enter}
        </Link>
        <span className={s.lede}>{c.lede}</span>
      </div>
    </section>
  );
}
