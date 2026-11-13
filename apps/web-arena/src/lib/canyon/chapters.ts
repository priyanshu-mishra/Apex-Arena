export type Vec3 = [number, number, number];

export type ChapterState = {
  pos: Vec3;
  tgt: Vec3;
  fov: number;
  focus: number;
  ap: number;
  split: number;
  dim: number;
  hist: number;
  face: number;
  agents: number;
  follow?: number;
  score: number;
  pool: number;
  orders: number;
};

/** The same scene, re-staged per chapter (prototype `ST`). */
export const CHAPTERS: ChapterState[] = [
  /* 00 canyon      */ { pos: [-1.2, 5.2, 17.5], tgt: [1.2, -0.6, -12], fov: 34, focus: 17, ap: 0.5, split: 0, dim: 1, hist: 1, face: 1, agents: 1, score: 0, pool: 0.9, orders: 1 },
  /* 01 depth chart */ { pos: [0.4, 2.6, 19], tgt: [0.4, 2.35, 0], fov: 30, focus: 19, ap: 1.0, split: 0, dim: 1, hist: 0.1, face: 2.4, agents: 1, follow: 1, score: 0, pool: 0, orders: 0.4 },
  /* 02 two venues  */ { pos: [3.4, 4.0, 23], tgt: [3.4, 2.9, -4], fov: 32, focus: 24, ap: 0.6, split: 0, dim: 1, hist: 0.35, face: 1.6, agents: 1, follow: 0.6, score: 0, pool: 1.5, orders: 0.8 },
  /* 03 chaos       */ { pos: [10, 7.5, 13], tgt: [-1.5, 2.2, -14], fov: 36, focus: 22, ap: 0.4, split: 0, dim: 1.15, hist: 1.25, face: 0.8, agents: 0, score: 0, pool: 0.4, orders: 1 },
  /* 04 barrier     */ { pos: [5.2, 2.3, 7.2], tgt: [-1.2, 2.7, 0], fov: 32, focus: 6.5, ap: 1.1, split: 0, dim: 0.8, hist: 1, face: 1, agents: 1, score: 0, pool: 0, orders: 1 },
  /* 05 score       */ { pos: [5.5, 3.0, 24], tgt: [5.5, 4.6, 3], fov: 36, focus: 21, ap: 1.2, split: 0, dim: 0.3, hist: 0.3, face: 0.5, agents: 1, score: 1, pool: 0, orders: 0 },
  /* 06 proof       */ { pos: [-19, 6.5, 17], tgt: [3.6, -1.0, -3], fov: 30, focus: 26, ap: 0.25, split: 1, dim: 1, hist: 0.1, face: 2.6, agents: 0, score: 0, pool: 0, orders: 0 },
  /* 07 the run     */ { pos: [-4, 15, 22], tgt: [3, 0, -22], fov: 34, focus: 34, ap: 0.3, split: 0, dim: 0.75, hist: 1, face: 0.6, agents: 0, score: 0, pool: 0.4, orders: 0.5 },
  /* 08 credit      */ { pos: [-2, 10, 20], tgt: [3, 0, -22], fov: 34, focus: 30, ap: 0.4, split: 0, dim: 0.7, hist: 1, face: 0.6, agents: 0, score: 0, pool: 0.4, orders: 0.5 },
  /* 09 flight      */ { pos: [0, 1.5, 6.5], tgt: [0, 1.2, -30], fov: 52, focus: 10, ap: 0.5, split: 0, dim: 1.1, hist: 1, face: 1, agents: 1, score: 0, pool: 0.3, orders: 1 },
];

/** Portrait camera overrides: [pos x,y,z, tgt x,y,z, fov] per chapter (prototype `m`). */
export const PORTRAIT: number[][] = [
  [0, 7, 32, 0, -0.8, -10, 46],
  [0, 3, 34, 0, 3.4, 0, 44],
  [5, 5, 40, 5, 4.5, -4, 46],
  [9, 12, 22, 0, 4, -14, 48],
  [4.5, 2.6, 13, -1, 3.4, 0, 46],
  [1.5, 5, 30, 1.5, 6.5, 3, 46],
  [-26, 12, 44, 3, 4, -10, 46],
  [-4, 18, 30, 0, 4, -22, 46],
  [-2, 12, 28, 0, 4, -22, 46],
  [0, 1.6, 8, 0, 1.6, -30, 62],
];

/** Chapter table for an aspect ratio; portrait (< 0.8) swaps camera pos/tgt/fov. */
export function chapterTable(aspect: number): ChapterState[] {
  if (aspect >= 0.8) return CHAPTERS;
  return CHAPTERS.map((c, i) => {
    const v = PORTRAIT[i];
    return { ...c, pos: [v[0], v[1], v[2]], tgt: [v[3], v[4], v[5]], fov: v[6] };
  });
}

const smoothstep = (e0: number, e1: number, x: number): number => {
  const k = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return k * k * (3 - 2 * k);
};

const mix = (a: number, b: number, k: number): number => a * (1 - k) + b * k;

/** Interpolate every numeric field; `t` is eased with smoothstep(0.08, 0.92). */
export function blendChapter(a: ChapterState, b: ChapterState, t: number): ChapterState {
  const k = smoothstep(0.08, 0.92, t);
  const v3 = (p: Vec3, q: Vec3): Vec3 => [mix(p[0], q[0], k), mix(p[1], q[1], k), mix(p[2], q[2], k)];
  return {
    pos: v3(a.pos, b.pos),
    tgt: v3(a.tgt, b.tgt),
    fov: mix(a.fov, b.fov, k),
    focus: mix(a.focus, b.focus, k),
    ap: mix(a.ap, b.ap, k),
    split: mix(a.split, b.split, k),
    dim: mix(a.dim, b.dim, k),
    hist: mix(a.hist, b.hist, k),
    face: mix(a.face, b.face, k),
    agents: mix(a.agents, b.agents, k),
    follow: mix(a.follow ?? 0, b.follow ?? 0, k),
    score: mix(a.score, b.score, k),
    pool: mix(a.pool, b.pool, k),
    orders: mix(a.orders, b.orders, k),
  };
}
