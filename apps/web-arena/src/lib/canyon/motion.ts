/**
 * Reduced motion for the landing page and the gate: the OS setting or `?rm`
 * (guide §7). Client only. Matches the pre-paint script in app/layout.tsx.
 */
export const prefersReducedMotion = (): boolean =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
  new URLSearchParams(window.location.search).has("rm");
