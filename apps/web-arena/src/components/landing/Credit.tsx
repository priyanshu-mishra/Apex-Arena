import { COPY, LINKEDIN_URL } from "@/content/landing";
import { cn } from "@/lib/utils";
import s from "./landing.module.css";
import { TitleLines } from "./TitleLines";

const c = COPY.c8;

/** 08 Credit: one statement at display size, then plain text links. */
export function Credit() {
  return (
    <section id={c.id} className={cn(s.flow, s.scrimF, s.credit)} data-bar-clip="">
      <p className={s.name}>
        <TitleLines lines={c.titleLines} />
      </p>
      <div className={s.links} data-rv="">
        <a href={c.github.href} rel="noopener">
          <span className={s.u}>{c.github.label}</span>
        </a>
        {/* Shown once LINKEDIN_URL (content/landing.ts) holds the real profile URL. */}
        {LINKEDIN_URL ? (
          <a href={LINKEDIN_URL} rel="noopener">
            <span className={s.u}>{c.linkedin.label}</span>
          </a>
        ) : null}
        <span className={s.fine}>{c.lede}</span>
      </div>
    </section>
  );
}
