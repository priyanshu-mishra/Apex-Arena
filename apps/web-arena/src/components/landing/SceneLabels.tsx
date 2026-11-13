"use client";

import { useEffect, useRef } from "react";
import { AGENTS, POOL_ORIGIN } from "@/lib/canyon/cast";
import { stagingTable } from "@/lib/canyon/chapters";
import { LEN, NL, SPAN, W, lvl, market } from "@/lib/canyon/model";
import type { CanyonScene, Projected } from "@/lib/canyon/scene";
import { canyonState, useCanyon } from "@/lib/canyon/store";
import { cn } from "@/lib/utils";

type Tone = "agent" | "note" | "bid" | "ask" | "pool";
type TagSpec = {
  key: string;
  tone: Tone;
  /** Leader on the right; the label sits left of its anchor. */
  left: boolean;
  plain: React.ReactNode;
  precise: React.ReactNode;
  /** World anchor for this frame, written into `out`. */
  anchor(scene: CanyonScene, out: [number, number, number]): void;
  /** Target opacity for a chapter. */
  visible(chapter: number, scene: CanyonScene, agentsOn: (c: number) => boolean): number;
};

const agentText = (name: string, role: string) => (
  <>
    {name}
    <i className="ml-[.6em] not-italic text-bone-3">{role}</i>
  </>
);

/** Top of the "now" face at depth fraction u on a side (mirrors the scene). */
function nowTop(scene: CanyonScene, u: number, side: -1 | 1, out: [number, number, number]) {
  const T = scene.time;
  const m = market(T, scene.marketEvents);
  out[0] = m.cx + side * (m.hs + u * W);
  out[1] = lvl(Math.floor(u * NL) + 1, T, side) * (1 - 0.82 * Math.min(1, Math.max(0, m.sh)) * Math.exp(-u * 3.2));
  out[2] = 0;
}

const TAGS: TagSpec[] = [
  ...AGENTS.map(
    (a, i): TagSpec => ({
      key: `agent-${i}`,
      tone: "agent",
      left: i === 0 || i === 3,
      plain: agentText(a.name, a.kind),
      precise: agentText(a.name, a.pk),
      anchor: (scene, out) => {
        const p = scene.agentPosition(i);
        out[0] = p.x; out[1] = p.y; out[2] = p.z;
      },
      visible: (c, _s, agentsOn) => (c === 5 && i === 4 ? 0 : agentsOn(c) ? 1 : 0),
    }),
  ),
  {
    key: "bid", tone: "bid", left: true,
    plain: "buy orders waiting", precise: "bid depth · L3 price-time FIFO",
    anchor: (s, out) => nowTop(s, 0.5, -1, out),
    visible: (c) => (c <= 1 ? 1 : 0),
  },
  {
    key: "ask", tone: "ask", left: false,
    plain: "sell orders waiting", precise: "ask depth · 14 price levels shown",
    anchor: (s, out) => nowTop(s, 0.64, 1, out),
    visible: (c) => (c <= 1 ? 1 : 0),
  },
  {
    key: "price", tone: "note", left: false,
    plain: "the price", precise: "mid · between best bid and best ask",
    anchor: (s, out) => {
      const m = market(s.time - 2.2, s.marketEvents);
      out[0] = m.cx; out[1] = 0; out[2] = (-2.2 / SPAN) * LEN;
    },
    visible: (c) => (c <= 1 ? 1 : 0),
  },
  {
    key: "past", tone: "note", left: false,
    plain: "8 seconds ago", precise: "t − 8 s · one rib per 1 s macro epoch",
    anchor: (s, out) => {
      const m = market(s.time - 8, s.marketEvents);
      out[0] = m.cx + m.hs + 1.2; out[1] = 0; out[2] = (-8 / SPAN) * LEN;
    },
    visible: (c) => (c === 0 || c === 3 ? 1 : 0),
  },
  {
    key: "pool", tone: "pool", left: false,
    plain: "on-chain pool", precise: "AMM · x·y = k · revm",
    anchor: (_s, out) => {
      out[0] = POOL_ORIGIN[0] + 1.2; out[1] = 4.6; out[2] = POOL_ORIGIN[2];
    },
    visible: (c) => (c === 0 || c === 2 ? 1 : 0),
  },
  {
    key: "bead", tone: "note", left: false,
    plain: "pool price", precise: "reserves (x, y)",
    anchor: (s, out) => {
      const b = s.beadPosition;
      out[0] = b.x; out[1] = b.y; out[2] = b.z;
    },
    visible: (c) => (c === 2 ? 1 : 0),
  },
  ...[0, 1, 2, 3, 4].map(
    (c): TagSpec => ({
      key: `run-${c}`, tone: "note", left: true,
      plain: `run ${c + 1}`, precise: `run ${c + 1}`,
      anchor: (s, out) => {
        const T = s.time;
        const m = market(T, s.marketEvents);
        out[0] = m.cx - m.hs - W; out[1] = lvl(NL, T, -1); out[2] = -(c - 2) * s.split * 4.2;
      },
      visible: (ch, s) => (ch === 6 ? s.split : 0),
    }),
  ),
];

const TONE: Record<Tone, string> = {
  agent: "text-bone",
  note: "text-bone-2 max-[860px]:hidden",
  bid: "text-bid max-[860px]:hidden",
  ask: "text-ask max-[860px]:hidden",
  pool: "text-pool max-[860px]:hidden",
};

/**
 * DOM labels pinned to scene objects (guide §3/§6). Positioned from
 * `scene.project` after every rendered frame; React only re-renders on a
 * Plain / Precise switch.
 */
export function SceneLabels({ scene }: { scene: CanyonScene }) {
  const precise = useCanyon((s) => s.depth === "precise");
  const els = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const rm = scene.reducedMotion;
    const fade = TAGS.map(() => 0);
    const shown = TAGS.map(() => "");
    const world: [number, number, number] = [0, 0, 0];
    const px: Projected = { x: 0, y: 0, visible: false };
    let aspect = 0;
    let table = stagingTable(window.innerWidth / window.innerHeight);
    const agentsOn = (c: number) => (table[c]?.agents ?? 0) > 0.9;

    const hide = (i: number, el: HTMLDivElement) => {
      if (shown[i] !== "0") { el.style.opacity = "0"; shown[i] = "0"; }
    };

    return scene.onFrame(() => {
      const a = window.innerWidth / window.innerHeight;
      if (a !== aspect) { aspect = a; table = stagingTable(a); }
      const st = canyonState();
      const ch = st.chapter;
      const gate = st.blend > 0.55 || ch === 0 ? 1 : 0;
      const extent = scene.extent;
      for (let i = 0; i < TAGS.length; i++) {
        const el = els.current[i];
        if (!el) continue;
        const t = TAGS[i];
        const target = t.visible(ch, scene, agentsOn) * gate * extent;
        fade[i] += (target - fade[i]) * (rm ? 1 : 0.12);
        if (fade[i] < 0.01) { hide(i, el); continue; }
        t.anchor(scene, world);
        scene.project(world, px);
        if (!px.visible) { hide(i, el); continue; }
        const o = fade[i].toFixed(3);
        if (shown[i] !== o) { el.style.opacity = o; shown[i] = o; }
        el.style.transform = t.left
          ? `translate3d(${(px.x - 8).toFixed(1)}px,${(px.y - 7).toFixed(1)}px,0) translateX(-100%)`
          : `translate3d(${(px.x + 8).toFixed(1)}px,${(px.y - 7).toFixed(1)}px,0)`;
      }
    });
  }, [scene]);

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-[2] overflow-hidden">
      {TAGS.map((t, i) => (
        <div
          key={t.key}
          ref={(el) => {
            els.current[i] = el;
          }}
          className={cn(
            "absolute left-0 top-0 whitespace-nowrap font-mono text-[12px] leading-[1.25] opacity-0 will-change-[transform,opacity]",
            "before:absolute before:top-[.6em] before:h-px before:w-4 before:bg-rule-2 before:content-['']",
            t.left ? "pr-[22px] before:right-0" : "pl-[22px] before:left-0",
            TONE[t.tone],
          )}
        >
          {precise ? t.precise : t.plain}
        </div>
      ))}
    </div>
  );
}
