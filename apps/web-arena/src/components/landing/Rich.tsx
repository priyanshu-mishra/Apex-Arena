import { Fragment } from "react";

/** Renders `*…*` spans of landing copy as <em> (bone emphasis in Precise lines). */
export function Rich({ text }: { text: string }) {
  const parts = text.split("*");
  return (
    <>
      {parts.map((p, i) => (i % 2 === 1 ? <em key={i}>{p}</em> : <Fragment key={i}>{p}</Fragment>))}
    </>
  );
}

