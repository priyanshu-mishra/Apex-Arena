import { Fragment } from "react";
import s from "./landing.module.css";

/**
 * Title split into `.ln` mask lines (revealed by a 105% → 0 yPercent slide).
 * Lines are joined by a space so the heading's text reads as one sentence.
 */
export function TitleLines({ lines }: { lines: readonly string[] }) {
  return (
    <>
      {lines.map((l, i) => (
        <Fragment key={i}>
          {i > 0 ? " " : null}
          <span className={s.ln} data-ln="">
            <span>{l}</span>
          </span>
        </Fragment>
      ))}
    </>
  );
}
