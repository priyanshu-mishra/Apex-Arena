/**
 * Copy regions: the page copy the scene's agent nodes, wires and lines dim
 * behind. The scene asks a copy source for CSS-pixel boxes every frame and
 * writes them into the `uCopyR` uniforms (shaders.ts `COPY_MASK`), so a node
 * or wire passing behind a heading, lede, table or instrument drops to a
 * faint trace instead of crossing the words. The hero (chapter 00) has no
 * copy regions: its first viewport stays exactly as approved.
 */
import { canyonState } from "./store";

export type CopyBox = { l: number; t: number; r: number; b: number };
export type CopySource = (out: CopyBox[]) => void;

/** Most boxes the shader reads (keep in step with `COPY_MASK`). */
export const MAX_COPY = 16;
/** Breathing room around each copy box, CSS px. */
export const COPY_PAD = 10;
/** Soft edge outside the padded box, CSS px. */
export const COPY_FEATHER = 14;
/** What is left of a node or wire behind copy. */
export const COPY_DIM = 0.08;

/** What counts as copy in a landing chapter. */
const LANDING_COPY = ":is(h1, h2, p, table, [data-shield], [role='img'])";
/** The gate's copy: the start-up steps, the title and the note. */
const GATE_COPY = "main :is(li, h1, p)";

function push(list: NodeListOf<HTMLElement>, out: CopyBox[]): void {
  const vh = window.innerHeight;
  const vw = window.innerWidth;
  for (const el of Array.from(list)) {
    if (out.length >= MAX_COPY) return;
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0 || r.bottom < 0 || r.top > vh || r.right < 0 || r.left > vw) continue;
    out.push({ l: r.left - COPY_PAD, t: r.top - COPY_PAD, r: r.right + COPY_PAD, b: r.bottom + COPY_PAD });
  }
}

/** Landing: the copy of the chapter(s) on screen, never the hero's. */
export const landingCopy: CopySource = (out) => {
  const st = canyonState();
  const ch = st.chapter | 0;
  for (const c of st.blend < 1 && ch > 0 ? [ch - 1, ch] : [ch]) {
    if (c <= 0) continue;
    push(document.querySelectorAll<HTMLElement>(`#c${c} ${LANDING_COPY}`), out);
  }
};

/** Gate: the boot list, title and note at the bottom of the screen. */
export const gateCopy: CopySource = (out) => {
  push(document.querySelectorAll<HTMLElement>(GATE_COPY), out);
};

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/**
 * CPU mirror of the shader's `copyMask()`, in CSS px: 1 away from copy,
 * `COPY_DIM` inside a (padded) box, a smooth ramp across the feather.
 */
export function copyMaskAt(boxes: readonly CopyBox[], x: number, y: number): number {
  let m = 1;
  for (const b of boxes.slice(0, MAX_COPY)) {
    const o = Math.max(b.l - x, x - b.r, b.t - y, y - b.b);
    m = Math.min(m, COPY_DIM + (1 - COPY_DIM) * smoothstep(0, COPY_FEATHER, o));
  }
  return m;
}
