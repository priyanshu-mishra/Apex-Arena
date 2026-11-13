import { COPY } from "@/content/landing";
import { cn } from "@/lib/utils";
import s from "./landing.module.css";
import { TitleLines } from "./TitleLines";

const c = COPY.c8;

/** 08 Credit: name at display size and plain text links. */
export function Credit() {
  return (
    <section id={c.id} className={cn(s.flow, s.scrimF, s.credit)}>
      <p className={s.by} data-rv="">
        {c.by}
      </p>
      <p className={s.name}>
        <TitleLines lines={c.titleLines} />
      </p>
      <div className={s.links} data-rv="">
        <a href={c.github.href} rel="noopener">
          <span className={s.u}>{c.github.label}</span>
        </a>
        {/* TODO(user): replace the href with the real LinkedIn profile URL and drop the marker. */}
        <a href={c.linkedin.href} data-todo="linkedin">
          <span className={s.u}>{c.linkedin.label}</span>
          <span className={s.todo}>{c.linkedin.todo}</span>
        </a>
        <span className={s.fine}>{c.lede}</span>
      </div>
    </section>
  );
}
