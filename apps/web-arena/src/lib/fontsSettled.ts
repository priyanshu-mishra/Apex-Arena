type FontSet = Pick<FontFaceSet, "ready" | "addEventListener" | "removeEventListener">;

/**
 * Calls `cb` once the page's web fonts have finished loading, and again
 * whenever a later batch finishes (a symbol supplement fetched on first use).
 * Text measured before then has fallback-font widths. Returns a cancel.
 */
export function onFontsSettled(cb: () => void, fonts: FontSet | undefined = globalThis.document?.fonts): () => void {
  if (!fonts) return () => {};
  let live = true;
  const run = () => {
    if (live) cb();
  };
  fonts.ready.then(run, () => {});
  fonts.addEventListener("loadingdone", run);
  return () => {
    live = false;
    fonts.removeEventListener("loadingdone", run);
  };
}
