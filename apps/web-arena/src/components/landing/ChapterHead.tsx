import { cn } from "@/lib/utils";
import s from "./landing.module.css";
import { Rich } from "./Rich";
import { TitleLines } from "./TitleLines";

/** A chapter's head: masked title lines, lede (revealed on scroll), optional Precise line. */
export function ChapterHead({
  copy,
  className,
  precise = true,
}: {
  copy: { titleLines: readonly string[]; lede: string; precise: string };
  className?: string;
  /** Show the chapter's Precise line under the lede (05 and 06 place it elsewhere). */
  precise?: boolean;
}) {
  return (
    <div className={cn(s.head, className)}>
      <h2 className={s.h2}>
        <TitleLines lines={copy.titleLines} />
      </h2>
      <p className={s.lede} data-rv="">
        {copy.lede}
      </p>
      {precise && copy.precise ? (
        <p className={s.precise}>
          <Rich text={copy.precise} />
        </p>
      ) : null}
    </div>
  );
}
