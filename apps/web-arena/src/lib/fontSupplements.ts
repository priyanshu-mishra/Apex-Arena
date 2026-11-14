/*
 * Symbol supplements. next/font's Google subsets (latin, latin-ext, …) leave
 * out the arrows, math signs and super/subscript digits the copy uses
 * ("seed 42 → 5/5", "≈", "10⁸"), so the browser drew them in a system font.
 * public/fonts/*-symbols.woff2 are the same variable fonts (wdth + wght axes)
 * cut to just those glyphs; copyright and the SIL OFL 1.1 notice stay in each
 * file's name table. Each leads its family's stack (globals.css --font-sans /
 * --font-mono), limited by unicode-range, so it draws only the characters it
 * has and everything else falls through.
 *
 * Declared from the root layout rather than globals.css so the URLs carry
 * NEXT_PUBLIC_BASE_PATH (the GitHub Pages build serves under /Apex-Arena).
 */
export const FONT_SUPPLEMENTS = [
  {
    family: "Archivo Symbols",
    file: "archivo-symbols.woff2",
    weight: "100 900",
    stretch: "62% 125%",
    range: "U+0394, U+03BC, U+2078, U+2081-2085, U+2190, U+2192, U+2194, U+221A, U+2248, U+2264-2265",
  },
  {
    family: "Martian Mono Symbols",
    file: "martian-symbols.woff2",
    weight: "100 800",
    stretch: "75% 112.5%",
    range: "U+2078, U+2081-2085, U+2190, U+2192, U+2248",
  },
] as const;

/** The supplements' @font-face rules, with every URL under `basePath`. */
export function fontSupplementCss(basePath = ""): string {
  const base = basePath.replace(/\/+$/, "");
  return FONT_SUPPLEMENTS.map(
    (f) =>
      `@font-face{font-family:"${f.family}";src:url("${base}/fonts/${f.file}") format("woff2");` +
      `font-weight:${f.weight};font-stretch:${f.stretch};font-display:swap;unicode-range:${f.range};}`,
  ).join("\n");
}
