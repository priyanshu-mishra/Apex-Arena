/**
 * CanyonScene: the landing page's single three.js scene ("The Canyon"), ported
 * from the approved prototype (docs/design/landing/index.html, gate.html).
 * Framework-free: React mounts it on a canvas, the store feeds it commands and
 * chapter state, and it never touches React state per frame.
 */
import * as THREE from "three";
import { AGENTS, POOL_ORIGIN, POOL_SCALE, SCORE_X } from "./cast";
import { blendChapter, stagingTable, type ChapterState, type Vec3 } from "./chapters";
import { createDprGovernor, stepDprGovernor } from "./dprGovernor";
import { LEN, NEV, NL, SPAN, W, lambda, lvl, market, midBase, type MarketEvent } from "./model";
import { REAL } from "./real";
import { canyonState, drainCanyonInbox, useCanyon, type CanyonStore, type Mood } from "./store";
import { buildBackground } from "./objects/background";
import { EdgeWriter, buildEdges } from "./objects/edges";
import { buildFloor } from "./objects/floor";
import { buildGate } from "./objects/gate";
import { buildNodes } from "./objects/nodes";
import { buildOrders } from "./objects/orders";
import { buildPool } from "./objects/pool";
import { buildSlices } from "./objects/slices";
import { buildTerrain } from "./objects/terrain";
import { buildThread } from "./objects/thread";
import { COLORS, type Uniforms } from "./objects/util";

export type SceneMode = "landing" | "gate";
export type SceneOptions = { mobile: boolean; reducedMotion: boolean; mode: SceneMode };
export type Regime = "calm" | "unsettled" | "flash crash" | "toxic flow" | "whale dump";
export type SceneStatus = {
  /** Fast-clock tick (10 ms each), six digits. */
  tick: number;
  /** Order-book mid in USD. */
  mid: number;
  spreadBps: number;
  lambda: number;
  regime: Regime;
  /** On-chain pool price in USD. */
  pool: number;
  /** Pool − book gap in bps (signed). */
  gapBps: number;
};
export type Projected = { x: number; y: number; visible: boolean };
/** Gate boot sequence: Task 8's timeline tweens these 0 → 1. */
export type GateBoot = { rise: number; extent: number; agents: number; push: number; run: number };

const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const sstep = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

const BLEND_KEYS = ["fov", "focus", "ap", "dim", "hist", "face", "agents", "follow", "score", "pool", "orders"] as const;
type BlendKey = (typeof BLEND_KEYS)[number];
const IDLE_MOODS: readonly Mood[] = ["toxic", "crash", "whale"];
const START_T = 30;
const OPENING_CRASH_S = 4.2;
const IDLE_CHECK_S = 8;
const INTRO_DELAY_S = 0.15;
const INTRO_S = 2.6;
const SLUG_S = 0.55;
const DPR_LOW = 1.25;

type Agent = { llm: boolean; hero: Vec3; score: Vec3; p: THREE.Vector3; pulse: number };

export class CanyonScene {
  /** True when the browser can create a WebGL2 context. */
  static supported(): boolean {
    if (typeof document === "undefined") return false;
    try {
      const gl = document.createElement("canvas").getContext("webgl2");
      if (!gl) return false;
      gl.getExtension("WEBGL_lose_context")?.loseContext();
      return true;
    } catch {
      return false;
    }
  }

  readonly mode: SceneMode;
  readonly reducedMotion: boolean;
  /** Gate only: the boot timeline drives these. All 1 under reduced motion. */
  readonly boot: GateBoot;

  private readonly canvas: HTMLCanvasElement;
  private readonly mobile: boolean;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera: THREE.PerspectiveCamera;
  private readonly U: Uniforms;
  private readonly OU: Uniforms;
  private readonly bg: Record<string, THREE.IUniform<number>>;
  private nodeGeo: THREE.BufferGeometry | null = null;
  private stemGeo: THREE.BufferGeometry | null = null;
  private edges: EdgeWriter | null = null;

  /* market */
  private T = START_T;
  private readonly events: MarketEvent[] = Array.from({ length: NEV }, () => ({ t: -1e4, mag: 0, dir: 1 as -1 | 1 }));
  private readonly evVec: THREE.Vector3[] = Array.from({ length: NEV }, () => new THREE.Vector3(-1e4, 0, 0));
  private evi = 0;
  private m = { cx: 0, hs: 0.16, sh: 0 };
  private lam = 0.2;
  private clob = 2241.5;
  private pool = 2241.5;
  private gapBps = 0;
  private beadR = 1;
  private heat = 0;
  private regime: Regime = "calm";
  private regimeUntil = 0;
  private whaleT = -1e4;
  private readonly _status: SceneStatus = { tick: 0, mid: 2241.5, spreadBps: 4, lambda: 0.2, regime: "calm", pool: 2241.5, gapBps: 0 };

  /* agents, bead, slug */
  private readonly agents: Agent[];
  private readonly bead = new THREE.Vector3();
  private readonly agentPos = Array.from({ length: 6 }, () => new THREE.Vector3());
  private readonly slug = { p: new THREE.Vector3(), from: new THREE.Vector3(), to: new THREE.Vector3(), life: 0, t: 0, f: 0, active: false };

  /* staging */
  private table: ChapterState[];
  private portrait: boolean;
  private blendKey = "";
  private blended: ChapterState;
  private readonly cur: { pos: THREE.Vector3; tgt: THREE.Vector3; split: number } & Record<BlendKey, number>;
  private readonly want = { pos: new THREE.Vector3(), tgt: new THREE.Vector3() };
  private readonly ptr = { x: 0, y: 0, sx: 0, sy: 0 };
  private timeScale = 1;
  private wasHeld = false;
  private epoch = Math.floor(START_T);

  /* clock, timers, loop */
  private clock = 0;
  private openingDone = false;
  private nextIdleCheck = IDLE_CHECK_S;
  private timers: { at: number; fn: () => void }[] = [];
  private raf = 0;
  private last = 0;
  private needsRender = true;
  private rendered = false;
  private w = 1;
  private h = 1;
  private dpr: number;
  private dprLowered = false;
  private readonly perf = createDprGovernor();
  private readonly listeners = new Set<() => void>();
  private readonly unsubscribe: () => void;
  private readonly v3 = new THREE.Vector3();
  private readonly pv = new THREE.Vector3();
  private readonly touch = new THREE.Vector3();

  constructor(canvas: HTMLCanvasElement, opts: SceneOptions) {
    this.canvas = canvas;
    this.mobile = opts.mobile;
    this.reducedMotion = opts.reducedMotion;
    this.mode = opts.mode;
    this.dpr = Math.min(window.devicePixelRatio || 1, this.dprCap);
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: "high-performance" });
    if (!this.renderer.capabilities.isWebGL2) {
      this.renderer.dispose();
      throw new Error("WebGL2 unavailable");
    }
    const aspect = (canvas.clientWidth || window.innerWidth) / (canvas.clientHeight || window.innerHeight);
    this.portrait = aspect < 0.8;
    this.camera = new THREE.PerspectiveCamera(this.mode === "gate" ? (this.portrait ? 48 : 34) : 36, aspect, 0.1, 300);
    this.table = stagingTable(aspect);
    this.blended = this.table[0];
    const s0 = this.table[0];
    this.cur = {
      pos: new THREE.Vector3(...s0.pos), tgt: new THREE.Vector3(...s0.tgt), split: s0.split,
      fov: s0.fov, focus: s0.focus, ap: s0.ap, dim: s0.dim, hist: s0.hist, face: s0.face, agents: s0.agents,
      follow: s0.follow ?? 0, score: s0.score, pool: s0.pool, orders: s0.orders,
    };

    const rm = this.reducedMotion;
    this.boot = rm ? { rise: 1, extent: 1, agents: 1, push: 1, run: 1 } : { rise: 0, extent: 0, agents: 0, push: 0, run: 0 };
    this.agents = AGENTS.map((a, i) => ({
      llm: a.llm,
      hero: a.hero,
      score: [SCORE_X[i], i < 4 ? 0.3 + (REAL.leaderboard.find((r) => r.agentId === a.name)?.acs ?? 0) * 5.4 : 1.0, 3] as Vec3,
      p: new THREE.Vector3(...a.hero),
      pulse: 0,
    }));

    this.U = {
      uT: { value: this.T }, uSpan: { value: SPAN }, uLen: { value: LEN }, uW: { value: W }, uSplit: { value: 0 },
      uPx: { value: 1000 }, uDpr: { value: this.dpr }, uFocus: { value: this.mode === "gate" ? 17 : 14 },
      uAp: { value: this.mode === "gate" ? 0.5 : 0.6 }, uExtent: { value: rm ? 1 : 0 }, uDim: { value: 1 }, uHist: { value: 1 },
      uFace: { value: 1 }, uEv: { value: this.evVec }, uRise: { value: 0 }, uAgents: { value: 0 },
      uBid: { value: COLORS.bid }, uAsk: { value: COLORS.ask }, uPool: { value: COLORS.pool }, uShock: { value: COLORS.shock },
      uBone: { value: COLORS.bone }, uGrey: { value: COLORS.grey },
    };
    this.OU = {
      uAgentPos: { value: this.agentPos }, uArb: { value: 0 }, uArbSide: { value: 1 }, uOrders: { value: 1 },
      uBeadR: { value: 1 }, uPoolA: { value: 1 }, uScore: { value: 0 },
    };

    const bg = buildBackground(this.mode === "gate");
    this.bg = bg.uniforms;
    this.scene.add(bg.mesh);
    if (this.mode === "gate") {
      for (const o of buildGate(this.U, this.mobile)) this.scene.add(o);
    } else {
      this.buildLanding();
      if (rm) {
        // The still shows a crash already under way.
        this.pushEvent(0.9, -1); this.T += 2.2; this.pushEvent(0.3, 1); this.T += 1.2;
      }
    }

    this.unsubscribe = useCanyon.subscribe(() => { this.needsRender = true; });
    if (this.mode === "landing") window.addEventListener("scroll", this.onScroll, { passive: true });
    this.resize(canvas.clientWidth || window.innerWidth, canvas.clientHeight || window.innerHeight);
  }

  private get dprCap(): number {
    return this.dprLowered ? DPR_LOW : this.mobile ? 1.5 : 1.75;
  }

  private buildLanding(): void {
    const { U, OU, mobile } = this;
    const add = (o: THREE.Object3D) => this.scene.add(o);
    add(buildTerrain(U, mobile));
    buildSlices(U).forEach(add);
    buildThread(U).forEach(add);
    add(buildFloor(U));
    add(buildOrders(U, OU, mobile));
    buildPool(U, OU, mobile).forEach(add);
    const nodes = buildNodes(U, OU);
    add(nodes.points);
    this.nodeGeo = nodes.geo;
    const e = buildEdges();
    add(e.tether);
    add(e.stems);
    this.edges = new EdgeWriter(e.tether.geometry);
    this.stemGeo = e.stems.geometry;
  }

  /* ───────────── public API ───────────── */

  start(): void {
    if (this.raf) return;
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.frame);
  }

  stop(): void {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  resize(w: number, h: number): void {
    this.w = Math.max(1, w);
    this.h = Math.max(1, h);
    this.dpr = Math.min(window.devicePixelRatio || 1, this.dprCap);
    this.U.uDpr.value = this.dpr;
    this.renderer.setPixelRatio(this.dpr);
    this.renderer.setSize(this.w, this.h, false);
    const aspect = this.w / this.h;
    const portrait = aspect < 0.8;
    if (portrait !== this.portrait) {
      this.portrait = portrait;
      this.table = stagingTable(aspect);
      this.blendKey = "";
    }
    if (this.mode === "gate") this.camera.fov = portrait ? 48 : 34;
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
    this.needsRender = true;
  }

  /** Pointer in viewport-normalised coordinates, −0.5…0.5 (parallax ±0.45 x, ±0.25 y). */
  setPointer(x: number, y: number): void {
    this.ptr.x = x;
    this.ptr.y = y;
  }

  /** World point → CSS pixels. Pass `out` to avoid allocating. Valid after the latest frame. */
  project(v: readonly [number, number, number], out?: Projected): Projected {
    const p = this.pv.set(v[0], v[1], v[2]).project(this.camera);
    const o = out ?? { x: 0, y: 0, visible: false };
    o.x = (p.x * 0.5 + 0.5) * this.w;
    o.y = (-p.y * 0.5 + 0.5) * this.h;
    o.visible = p.z <= 1 && Math.abs(p.x) <= 1.05 && Math.abs(p.y) <= 1.05;
    return o;
  }

  /** Live readouts for the status line (updated every rendered frame). */
  get status(): Readonly<SceneStatus> {
    return this._status;
  }

  /** Simulation time in seconds. */
  get time(): number {
    return this.T;
  }

  /** The scene's event ring buffer (read-only view). */
  get marketEvents(): readonly MarketEvent[] {
    return this.events;
  }

  /** Intro reveal 0 → 1. */
  get extent(): number {
    return this.U.uExtent.value as number;
  }

  /** Proof chapter: how far the five run copies are pulled apart (0–1). */
  get split(): number {
    return this.U.uSplit.value as number;
  }

  /** Agent i (0–4) world position this frame. */
  agentPosition(i: number): Readonly<THREE.Vector3> {
    return this.agents[i].p;
  }

  /** Pool bead (current reserves) world position this frame. */
  get beadPosition(): Readonly<THREE.Vector3> {
    return this.bead;
  }

  /** Called after every rendered frame (labels position themselves here). Returns an unsubscribe. */
  onFrame(cb: () => void): () => void {
    this.listeners.add(cb);
    this.needsRender = true; // a reduced-motion still must render once more for a late subscriber
    return () => this.listeners.delete(cb);
  }

  dispose(): void {
    this.stop();
    this.unsubscribe();
    window.removeEventListener("scroll", this.onScroll);
    this.listeners.clear();
    this.timers = [];
    const disposed = new Set<unknown>();
    this.scene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.geometry && !disposed.has(mesh.geometry)) { disposed.add(mesh.geometry); mesh.geometry.dispose(); }
      const mats = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : [];
      for (const mat of mats) if (!disposed.has(mat)) { disposed.add(mat); mat.dispose(); }
    });
    this.scene.clear();
    this.renderer.dispose();
    delete this.canvas.dataset.state;
  }

  /* ───────────── market & regimes ───────────── */

  private onScroll = () => { this.needsRender = true; };

  private pushEvent(mag: number, dir: -1 | 1): void {
    const e = this.events[this.evi];
    e.t = this.T; e.mag = mag; e.dir = dir;
    this.evVec[this.evi].set(this.T, mag, dir);
    this.evi = (this.evi + 1) % NEV;
    if (this.reducedMotion) this.T += 1.6;
    this.needsRender = true;
  }

  private later(ms: number, fn: () => void): void {
    if (this.reducedMotion) fn();
    else this.timers.push({ at: this.clock + ms / 1000, fn });
  }

  private runTimers(): void {
    if (!this.timers.some((t) => t.at <= this.clock)) return;
    const due = this.timers.filter((t) => t.at <= this.clock);
    this.timers = this.timers.filter((t) => t.at > this.clock);
    for (const t of due) t.fn();
  }

  private setRegime(name: Regime, secs: number): void {
    this.regime = name;
    this.regimeUntil = this.T + secs;
  }

  private trigger(kind: Mood, fromUser: boolean): void {
    this.timers = [];
    if (!fromUser) useCanyon.setState({ mood: kind });
    const fire = (mag: number, dir: -1 | 1) => () => this.pushEvent(mag, dir);
    if (kind === "calm") this.setRegime("calm", 0);
    if (kind === "crash") {
      this.setRegime("flash crash", 9);
      this.pushEvent(1.0, -1);
      this.later(900, fire(0.45, -1)); this.later(2100, fire(0.3, 1)); this.later(3600, fire(0.22, -1));
    }
    if (kind === "toxic") {
      this.setRegime("toxic flow", 8);
      [0, 500, 1100, 1500, 2300, 3200].forEach((ms, i) =>
        this.later(ms, fire(0.16 + (0.1 * ((i * 7) % 3)) / 2, i % 3 === 1 ? 1 : -1)),
      );
    }
    if (kind === "whale") {
      this.setRegime("whale dump", 8);
      this.whaleT = this.T;
      this.later(700, fire(0.5, -1)); this.later(1900, fire(0.2, -1));
    }
  }

  /** Top of the "now" face at depth fraction u on a side, written into `out`. */
  private nowTop(u: number, side: -1 | 1, out: THREE.Vector3): THREE.Vector3 {
    const m = market(this.T, this.events);
    return out.set(
      m.cx + side * (m.hs + u * W),
      lvl(Math.floor(u * NL) + 1, this.T, side) * (1 - 0.82 * clamp(m.sh) * Math.exp(-u * 3.2)),
      0,
    );
  }

  private sendOrder(qty: number): void {
    const f = qty / 45;
    if (this.reducedMotion) { this.pushEvent(0.12 + f * 0.5, 1); return; }
    if (this.slug.active) this.landSlug();
    const s = this.slug;
    s.from.copy(this.agents[4].p);
    this.nowTop(0.02, 1, s.to);
    s.f = f; s.t = 0; s.life = 1; s.active = true;
    s.p.copy(s.from);
  }

  private landSlug(): void {
    const s = this.slug;
    s.active = false; s.life = 0;
    this.pushEvent(0.12 + s.f * 0.5, 1);
    this.agents[4].pulse = 1;
  }

  private stepSlug(dt: number): void {
    const s = this.slug;
    if (!s.active) return;
    s.t = Math.min(1, s.t + dt / SLUG_S);
    const k = s.t * s.t; // power2.in
    s.p.lerpVectors(s.from, s.to, k);
    s.p.y += Math.sin(k * Math.PI) * 1.2;
    if (s.t >= 1) this.landSlug();
  }

  private consume(st: CanyonStore): void {
    const cmds = drainCanyonInbox();
    for (const c of cmds) {
      if (c.kind === "fire") this.pushEvent(c.mag, c.dir);
      else if (c.kind === "mood") this.trigger(c.mood, true);
      else this.sendOrder(c.qty);
    }
    if (this.reducedMotion) return;
    const inHero = st.chapter === 0 || (st.chapter === 1 && st.blend < 0.5);
    if (!this.openingDone && this.clock >= OPENING_CRASH_S) {
      // The signature moment plays once on its own, unless the visitor got there first.
      this.openingDone = true;
      if (!st.userActed && inHero) this.trigger("crash", false);
    }
    if (this.clock >= this.nextIdleCheck) {
      this.nextIdleCheck += IDLE_CHECK_S;
      if (this.T > this.regimeUntil + 22 && (st.chapter === 0 || st.chapter === 9))
        this.trigger(IDLE_MOODS[Math.floor(this.T) % 3], false);
    }
  }

  private sim(): void {
    this.m = market(this.T, this.events);
    this.lam = lambda(this.T, this.events);
    const clob = 2241.5 + this.m.cx * 14;
    const wdt = this.T - this.whaleT;
    const whale = wdt > 0 ? -0.021 * Math.exp(-wdt * 0.45) : 0;
    const pool = clob * (1 + 0.0021 * Math.sin(this.T * 0.37) + 0.0015 * Math.sin(this.T * 0.91 + 2) + whale);
    this.clob = clob;
    this.pool = pool;
    this.gapBps = ((pool - clob) / clob) * 1e4;
    this.beadR = clamp(1 - (pool / clob - 1) * 60, 0.45, 2.6);
  }

  private updateStatus(st: CanyonStore): void {
    const s = this._status;
    const r: Regime = this.T < this.regimeUntil ? this.regime : this.lam > 0.6 ? "unsettled" : "calm";
    s.tick = Math.floor(this.T * 100) % 1_000_000;
    s.mid = this.clob;
    s.spreadBps = 4 + 40 * clamp(this.m.sh);
    s.lambda = this.lam;
    s.regime = r;
    s.pool = this.pool;
    s.gapBps = this.gapBps;
    if (r === "calm" && this.T > this.regimeUntil + 1 && st.mood !== "calm") useCanyon.setState({ mood: "calm" });
  }

  /* ───────────── frame ───────────── */

  private frame = (now: number): void => {
    this.raf = requestAnimationFrame(this.frame);
    const raw = now - this.last;
    this.last = now;
    const dt = Math.min(0.05, raw / 1000);
    if (document.hidden) return;
    if (this.mode === "gate") this.frameGate(dt);
    else this.frameLanding(dt);
    if (!this.reducedMotion) this.watchPerf(raw);
  };

  /** Drop DPR to 1.25 once if a 2 s window averages over 22 ms per frame (warm-up and outliers ignored). */
  private watchPerf(raw: number): void {
    if (this.dprLowered) return;
    if (stepDprGovernor(this.perf, raw) && this.dpr > DPR_LOW) {
      this.dprLowered = true;
      this.resize(this.w, this.h);
    }
  }

  private blendFor(ch: number, t: number): ChapterState {
    const key = `${ch}:${t}`;
    if (key !== this.blendKey) {
      this.blendKey = key;
      this.blended = blendChapter(this.table[Math.max(0, ch - 1)], this.table[ch], t);
    }
    return this.blended;
  }

  private frameLanding(dt: number): void {
    const rm = this.reducedMotion;
    const st = canyonState();
    this.clock += dt;
    this.consume(st);
    if (!rm) this.runTimers();
    if (rm && !this.needsRender) return;
    this.needsRender = false;

    /* chapter-local behaviour */
    const ch = Math.min(Math.max(0, st.chapter | 0), this.table.length - 1);
    const chBlend = ch === 0 ? 1 : clamp(st.blend);
    const p4 = st.progress[4] ?? 0, p6 = st.progress[6] ?? 0;
    const in4 = ch === 4 && chBlend > 0.98;
    const held = in4 && p4 >= 0.42 && p4 < 0.86;
    if (held && !this.wasHeld) for (const a of this.agents) if (a.llm) a.pulse = 1;
    this.wasHeld = held;
    this.timeScale += ((held ? 0 : in4 ? lerp(1, 0.12, sstep(0.1, 0.42, p4)) : 1) - this.timeScale) * (rm ? 1 : 0.18);

    /* time */
    if (!rm) this.T += dt * this.timeScale;
    const U = this.U, OU = this.OU, cur = this.cur, T = this.T;
    U.uT.value = T;
    this.sim();
    if (!rm && Math.floor(T) !== this.epoch) {
      // The 1 s barrier: thinking agents act together.
      this.epoch = Math.floor(T);
      for (const a of this.agents) if (a.llm) a.pulse = 1;
    }
    this.heat += (clamp(this.m.sh * 1.4) - this.heat) * 0.08;
    if (!rm) U.uExtent.value = this.clock < INTRO_DELAY_S ? 0 : 1 - Math.pow(1 - clamp((this.clock - INTRO_DELAY_S) / INTRO_S), 2);
    this.stepSlug(dt);

    /* blend chapter state */
    const b = this.blendFor(ch, chBlend);
    const want = this.want;
    want.pos.set(b.pos[0], b.pos[1], b.pos[2]);
    want.tgt.set(b.tgt[0], b.tgt[1], b.tgt[2]);
    if (ch === 4) { const o = (p4 - 0.5) * 1.1; want.pos.x += Math.sin(o) * 5; want.pos.z += (Math.cos(o) - 1) * 3; } // bullet-time orbit
    if (ch === 0) want.pos.z -= clamp(window.scrollY / window.innerHeight) * 1.5;
    const damp = rm ? 1 : 1 - Math.exp(-dt * 3.2);
    cur.pos.lerp(want.pos, damp);
    cur.tgt.lerp(want.tgt, damp);
    for (const key of BLEND_KEYS) cur[key] += ((b[key] ?? 0) - cur[key]) * damp;
    const splitWant = b.split * (ch === 6 ? 1 - sstep(0.58, 0.9, p6) : 1);
    cur.split += (splitWant - cur.split) * damp;

    /* camera */
    const ptr = this.ptr, cam = this.camera;
    ptr.sx += (ptr.x - ptr.sx) * 0.05;
    ptr.sy += (ptr.y - ptr.sy) * 0.05;
    cam.position.copy(cur.pos);
    const fx = this.m.cx * cur.follow;
    cam.position.x += fx;
    if (!rm) { cam.position.x += ptr.sx * 0.9; cam.position.y -= ptr.sy * 0.5; }
    cam.fov = cur.fov;
    cam.updateProjectionMatrix();
    this.v3.copy(cur.tgt);
    this.v3.x += fx;
    cam.lookAt(this.v3);
    cam.updateMatrixWorld();

    /* agents */
    this.agents.forEach((ag, i) => {
      const bob = rm ? 0 : Math.sin(T * (0.5 + i * 0.13) + i * 2.1) * 0.12;
      ag.p.set(
        lerp(ag.hero[0], ag.score[0], cur.score),
        lerp(ag.hero[1], ag.score[1], cur.score) + bob * (1 - cur.score),
        lerp(ag.hero[2], ag.score[2], cur.score),
      );
      this.agentPos[i].copy(ag.p);
      ag.pulse *= rm ? 1 : 0.94;
    });
    this.bead.set(POOL_ORIGIN[0] + this.beadR * POOL_SCALE, POOL_SCALE / this.beadR, POOL_ORIGIN[2]);
    this.agentPos[5].copy(this.bead);

    /* uniforms */
    U.uPx.value = this.renderer.domElement.height / (2 * Math.tan((cam.fov * Math.PI) / 360));
    U.uFocus.value = cur.focus; U.uAp.value = cur.ap; U.uDim.value = cur.dim; U.uSplit.value = cur.split; U.uFace.value = cur.face;
    U.uHist.value = ch === 6 ? lerp(cur.hist, 1, sstep(0.62, 0.92, p6)) : cur.hist;
    OU.uScore.value = cur.score; OU.uPoolA.value = cur.pool; OU.uOrders.value = cur.orders; OU.uBeadR.value = this.beadR;
    OU.uArb.value = Math.min(1, cur.pool) * sstep(22, 40, Math.abs(this.gapBps));
    OU.uArbSide.value = this.gapBps > 0 ? -1 : 1;
    this.writeNodes();
    this.writeEdges();

    /* horizon */
    this.v3.set(market(T - SPAN, this.events).cx, 0, -LEN * 3).project(cam);
    this.bg.uHor.value += (clamp(this.v3.y, -1.6, 1.6) - this.bg.uHor.value) * (rm ? 1 : 0.2);
    this.bg.uHeat.value = this.heat;

    this.renderer.render(this.scene, cam);
    this.updateStatus(st);
    this.afterRender();
  }

  private writeNodes(): void {
    const geo = this.nodeGeo;
    if (!geo) return;
    const cur = this.cur, slug = this.slug;
    const np = geo.attributes.position as THREE.BufferAttribute;
    const pu = geo.attributes.aPulse as THREE.BufferAttribute;
    const li = geo.attributes.aLife as THREE.BufferAttribute;
    this.agents.forEach((ag, i) => {
      np.setXYZ(i, ag.p.x, ag.p.y, ag.p.z);
      pu.setX(i, ag.pulse);
      li.setX(i, (i === 3 ? lerp(1, -1, cur.score) : i === 4 ? lerp(1, 0, cur.score) : 1) * cur.agents);
    });
    np.setXYZ(5, this.bead.x, this.bead.y, this.bead.z);
    li.setX(5, Math.min(1, cur.pool));
    np.setXYZ(6, slug.p.x, slug.p.y, slug.p.z);
    li.setX(6, slug.life);
    np.needsUpdate = pu.needsUpdate = li.needsUpdate = true;
  }

  private writeEdges(): void {
    const edges = this.edges, stemGeo = this.stemGeo;
    if (!edges || !stemGeo) return;
    const cur = this.cur;
    this.touch.set(this.m.cx, 0.06, 0);
    const ext = this.extent * (1 - cur.score) * cur.agents;
    const poolK = Math.min(1, cur.pool);
    edges.begin();
    for (const ag of this.agents) {
      edges.edge(ag.p, this.touch, 0.5, COLORS.bone, (0.1 + ag.pulse * 0.55) * ext);
      edges.edge(ag.p, this.bead, 1.4, COLORS.pool, (0.04 + ag.pulse * 0.25) * ext * poolK);
    }
    edges.end();
    const sp = stemGeo.attributes.position as THREE.BufferAttribute, sc = stemGeo.attributes.color as THREE.BufferAttribute;
    const k2 = cur.score * 0.55;
    for (let i = 0; i < 4; i++) {
      const ag = this.agents[i], cc = i === 3 ? COLORS.ask : COLORS.bone;
      sp.setXYZ(i * 2, ag.p.x, 0, ag.p.z);
      sp.setXYZ(i * 2 + 1, ag.p.x, ag.p.y, ag.p.z);
      sc.setXYZ(i * 2, cc.x * k2 * 0.2, cc.y * k2 * 0.2, cc.z * k2 * 0.2);
      sc.setXYZ(i * 2 + 1, cc.x * k2, cc.y * k2, cc.z * k2);
    }
    sp.needsUpdate = sc.needsUpdate = true;
  }

  private frameGate(dt: number): void {
    const b = this.boot, U = this.U, cam = this.camera;
    if (this.reducedMotion) {
      if (!this.needsRender) return;
    } else {
      this.T += dt * b.run;
    }
    this.needsRender = false;
    U.uT.value = this.T;
    U.uRise.value = b.rise; U.uExtent.value = b.extent; U.uAgents.value = b.agents;
    this.bg.uOn.value = b.extent;
    const k = b.push, P = this.portrait;
    // From a high plan view down into the hero framing.
    cam.position.set(-1.2 * k, (P ? 7 : 5.2) + (1 - k) * 16, (P ? 32 : 17.5) + (1 - k) * 10);
    cam.lookAt(1.2 * k, P ? 1 : 1.6 - k * 0.6, -12 * k);
    cam.updateMatrixWorld();
    U.uPx.value = this.renderer.domElement.height / (2 * Math.tan((cam.fov * Math.PI) / 360));
    this.v3.set(0, 0, -LEN * 3).project(cam);
    this.bg.uHor.value = clamp(this.v3.y, -1.6, 1.6);
    this.renderer.render(this.scene, cam);

    const s = this._status;
    s.tick = b.run ? Math.max(0, Math.floor((this.T - START_T) * 100)) : 0;
    s.mid = 2241.5 + midBase(this.T) * 14;
    s.pool = s.mid;
    this.afterRender();
  }

  private afterRender(): void {
    if (!this.rendered) {
      this.rendered = true;
      this.canvas.dataset.state = "running";
    }
    for (const cb of this.listeners) cb();
  }
}
