import { create } from "zustand";
import type { CanyonScene } from "./scene";

export type Depth = "plain" | "precise";
export type Mood = "calm" | "toxic" | "whale" | "crash";

export const CHAPTER_COUNT = 10;

/**
 * Commands for the scene. They live outside React state: the scene drains
 * them each frame and owns its own event ring buffer.
 */
export type CanyonCommand =
  | { kind: "fire"; mag: number; dir: -1 | 1 }
  | { kind: "mood"; mood: Mood }
  | { kind: "order"; qty: number };

const inbox: CanyonCommand[] = [];
const NONE: readonly CanyonCommand[] = Object.freeze([]);

/** Take every pending command (called by the scene once per frame). */
export function drainCanyonInbox(): readonly CanyonCommand[] {
  if (inbox.length === 0) return NONE;
  return inbox.splice(0, inbox.length);
}

export type CanyonStore = {
  /** Index of the chapter whose top has entered the viewport (0–9). */
  chapter: number;
  /** How far that chapter has travelled up the viewport (0–1); the camera blends chapter−1 → chapter by it. */
  blend: number;
  /** Progress through each sticky chapter (0–1). */
  progress: number[];
  depth: Depth;
  /** Market mood, as shown on the mood selector. The scene resets it to `calm` when a regime ends. */
  mood: Mood;
  reducedMotion: boolean;
  /** True once the visitor has fired, traded or picked a mood (suppresses the opening crash). */
  userActed: boolean;
  /** The live scene, once mounted (null on the server, without WebGL2, or before load). */
  scene: CanyonScene | null;
  fire(mag: number, dir: -1 | 1): void;
  setChapter(i: number, blend: number): void;
  setProgress(i: number, p: number): void;
  setDepth(d: Depth): void;
  sendOrder(qty: number): void;
  /** Trigger a mood: sets the regime and plays its event sequence in the scene. */
  setMood(m: Mood): void;
  setReducedMotion(rm: boolean): void;
  setScene(scene: CanyonScene | null): void;
};

export const useCanyon = create<CanyonStore>()((set, get) => ({
  chapter: 0,
  blend: 1,
  progress: Array.from({ length: CHAPTER_COUNT }, () => 0),
  depth: "plain",
  mood: "calm",
  reducedMotion: false,
  userActed: false,
  scene: null,
  fire: (mag, dir) => {
    inbox.push({ kind: "fire", mag, dir });
    if (!get().userActed) set({ userActed: true });
  },
  setChapter: (i, blend) => {
    const s = get();
    if (s.chapter !== i || s.blend !== blend) set({ chapter: i, blend });
  },
  setProgress: (i, p) => {
    const s = get();
    if (s.progress[i] === p) return;
    const progress = s.progress.slice();
    progress[i] = p;
    set({ progress });
  },
  setDepth: (depth) => set({ depth }),
  sendOrder: (qty) => {
    inbox.push({ kind: "order", qty });
    if (!get().userActed) set({ userActed: true });
  },
  setMood: (mood) => {
    inbox.push({ kind: "mood", mood });
    set({ mood, userActed: true });
  },
  setReducedMotion: (reducedMotion) => set({ reducedMotion }),
  setScene: (scene) => set({ scene }),
}));

/** Non-React read of the store; the scene calls this once per frame. */
export const canyonState = (): CanyonStore => useCanyon.getState();

// Test-only probe (e2e "scene blend follows scroll"); compiled out of production builds.
if (process.env.NODE_ENV !== "production" && typeof window !== "undefined")
  (window as Window & { __canyonState?: () => CanyonStore }).__canyonState = canyonState;
