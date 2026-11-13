import { Fragment, type ReactNode } from "react";

/** `_{x}` → <sub>x</sub>, `^{x}` → <sup>x</sup> inside one span of copy. */
function scripts(text: string, key: number): ReactNode {
  const parts = text.split(/([_^])\{([^}]*)\}/);
  if (parts.length === 1) return <Fragment key={key}>{text}</Fragment>;
  const out: ReactNode[] = [];
  for (let i = 0; i < parts.length; i += 3) {
    if (parts[i]) out.push(<Fragment key={i}>{parts[i]}</Fragment>);
    if (i + 2 < parts.length)
      out.push(parts[i + 1] === "_" ? <sub key={i + 1}>{parts[i + 2]}</sub> : <sup key={i + 1}>{parts[i + 2]}</sup>);
  }
  return <Fragment key={key}>{out}</Fragment>;
}

/**
 * Renders `*…*` spans of landing copy as <em> (bone emphasis in Precise
 * lines) and `_{…}` / `^{…}` as subscripts / superscripts.
 */
export function Rich({ text }: { text: string }) {
  const parts = text.split("*");
  return <>{parts.map((p, i) => (i % 2 === 1 ? <em key={i}>{scripts(p, 0)}</em> : scripts(p, i)))}</>;
}
