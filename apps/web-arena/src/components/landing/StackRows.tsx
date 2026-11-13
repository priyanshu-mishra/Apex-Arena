import { COPY } from "@/content/landing";
import { cn } from "@/lib/utils";
import s from "./landing.module.css";
import { Rich } from "./Rich";
import { TitleLines } from "./TitleLines";

const c = COPY.c7;

/** 07 Stack: four typographic rows (word / language / one sentence; Precise adds crates). */
export function StackRows() {
  return (
    <section id={c.id} className={cn(s.flow, s.scrimF)}>
      <h2 className={cn(s.h2, s.stackTitle)}>
        <TitleLines lines={c.titleLines} />
      </h2>
      <div className={s.stack}>
        {c.layers.map((l) => (
          <div key={l.word} className={s.layer} data-rv="">
            <span className={s.layerW}>{l.word}</span>
            <span className={s.layerT}>{l.lang}</span>
            <div className={s.layerD}>
              {l.plain}
              <p className={s.precise}>
                <Rich text={l.precise} />
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
