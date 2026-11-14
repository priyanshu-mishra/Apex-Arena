import type { ReactNode } from "react";
import { lede as ledeCls, pageTitle } from "../ui/kit";

/** Page title + lede in the landing's type, with an optional meta row on the right. */
export function PageHead({ title, lede, meta, children }: { title: string; lede: ReactNode; meta?: ReactNode; children?: ReactNode }) {
  return (
    <header className="flex min-w-0 flex-col gap-4 pt-2 md:flex-row md:items-end md:justify-between md:gap-10">
      <div className="flex min-w-0 flex-col gap-3.5">
        <h1 className={pageTitle}>{title}</h1>
        <p className={ledeCls}>{lede}</p>
        {children}
      </div>
      {meta ? <div className="flex shrink-0 flex-wrap items-center gap-2">{meta}</div> : null}
    </header>
  );
}
