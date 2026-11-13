"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { CanyonCanvas } from "@/components/landing/CanyonCanvas";
import s from "@/components/landing/landing.module.css";
import { StatusLine } from "@/components/landing/StatusLine";
import { TitleLines } from "@/components/landing/TitleLines";
import { TopBar } from "@/components/landing/TopBar";
import { GATE } from "@/content/landing";
import { prefersReducedMotion } from "@/lib/canyon/motion";
import type { GateBoot } from "@/lib/canyon/scene";
import { useCanyon } from "@/lib/canyon/store";
import { cn } from "@/lib/utils";
import { BootList } from "./BootList";
import g from "./gate.module.css";

gsap.registerPlugin(useGSAP);

/** Longest wait for the scene before the boot runs without it (no WebGL2, a slow chunk). */
const SCENE_WAIT_MS = 1200;

const TITLE_LINES = [GATE.title] as const;

/** idle: server markup, before the gate has run · play: boot timeline · done: the arena is open. */
type Phase = "idle" | "play" | "done";

/**
 * The gate at /enter: the deliberate step between the landing page and the
 * app. One 2.6 s GSAP timeline (guide §5 Gate) boots the Canyon in gate mode
 * by tweening `scene.boot`, lights the three start-up steps, reveals the
 * title and hands focus to "Continue as guest". Under reduced motion the
 * final frame shows at once. "Sign in" is the future auth slot.
 */
export function Gate() {
  const root = useRef<HTMLDivElement>(null);
  const seed = useRef<HTMLDivElement>(null);
  const guest = useRef<HTMLAnchorElement>(null);
  const timeline = useRef<gsap.core.Timeline | null>(null);
  /** The timeline tweens these; they are copied into the scene, which may mount later. */
  const boot = useRef<GateBoot>({ rise: 0, extent: 0, agents: 0, push: 0, run: 0 });
  const [phase, setPhase] = useState<Phase>("idle");
  const [lit, setLit] = useState(0);

  // A landing scene can still be in the store for a moment after client navigation.
  const scene = useCanyon((st) => (st.scene?.mode === "gate" ? st.scene : null));
  const sceneRef = useRef(scene);

  useGSAP(
    () => {
      // This page drives its own reveals: retire the pre-paint hidden state first,
      // so GSAP never reads the CSS offset as a starting value.
      document.documentElement.removeAttribute("data-motion");
      (window as Window & { __apexMotion?: boolean }).__apexMotion = true;

      const B = boot.current;
      const open = () => {
        setPhase("done");
        guest.current?.focus({ preventScroll: true });
      };

      if (prefersReducedMotion()) {
        Object.assign(B, { rise: 1, extent: 1, agents: 1, push: 1, run: 1 });
        setLit(GATE.boot.length);
        open();
        return;
      }

      Object.assign(B, { rise: 0, extent: 0, agents: 0, push: 0, run: 0 });
      setLit(0);
      setPhase("play");
      const el = root.current!;
      const title = el.querySelectorAll("[data-ln] > span");
      const rv = el.querySelectorAll("[data-gate-rv]");
      gsap.set(title, { yPercent: 105 });
      gsap.set(rv, { opacity: 0, y: 14 });

      const sync = () => {
        if (sceneRef.current) Object.assign(sceneRef.current.boot, B);
      };
      timeline.current = gsap
        .timeline({ paused: true, defaults: { ease: "power2.out" }, onUpdate: sync })
        // 0.00: seed numeral fades in; line 1 lights.
        .from(seed.current, { opacity: 0, scale: 0.92, duration: 0.35 }, 0)
        .add(() => setLit(1), 0.1)
        // 0.25–1.15: the now face rises level by level.
        .to(B, { rise: 1, duration: 0.9, ease: "power3.out" }, 0.25)
        // 0.45–2.55: camera descends from the plan view into the hero framing.
        .to(B, { push: 1, duration: 2.1, ease: "expo.inOut" }, 0.45)
        // 0.70–1.20: seed lifts 24px and fades.
        .to(seed.current, { opacity: 0, y: -24, duration: 0.5, ease: "power2.in" }, 0.7)
        // 0.90–2.20: line 2; history extrudes to the horizon; the clock starts.
        .add(() => {
          setLit(2);
          B.run = 1;
        }, 0.9)
        .to(B, { extent: 1, duration: 1.3, ease: "power2.inOut" }, 0.9)
        // 1.80–2.40: line 3; the five nodes appear one after another.
        .add(() => setLit(3), 1.8)
        .to(B, { agents: 1, duration: 0.6, ease: "none" }, 1.8)
        // 2.30: title mask reveal.
        .to(title, { yPercent: 0, duration: 0.9, ease: "expo.out" }, 2.3)
        // 2.55: buttons and note fade up; 2.60: focus moves to "Continue as guest".
        .to(rv, { opacity: 1, y: 0, duration: 0.6, stagger: 0.08 }, 2.55)
        .add(open, 2.6);

      return () => {
        timeline.current = null;
      };
    },
    { scope: root },
  );

  // The boot plays once the gate scene is up (or after SCENE_WAIT_MS without it).
  useEffect(() => {
    sceneRef.current = scene;
    if (!scene) return;
    Object.assign(scene.boot, boot.current);
    timeline.current?.play();
  }, [scene]);

  useEffect(() => {
    const id = window.setTimeout(() => timeline.current?.play(), SCENE_WAIT_MS);
    return () => window.clearTimeout(id);
  }, []);

  return (
    <div ref={root} className={cn(s.root, g.gate)} data-boot={phase === "idle" ? undefined : phase}>
      <CanyonCanvas mode="gate" />
      <TopBar variant="gate" />

      <div className={g.seed} aria-hidden="true">
        <div ref={seed} data-testid="gate-seed">
          <b>{GATE.seed}</b>
          <span>{GATE.seedCaption}</span>
        </div>
      </div>

      <main className={g.panel}>
        <BootList lit={lit} />
        <div className={g.ready}>
          <h1 className={g.title}>
            <TitleLines lines={TITLE_LINES} />
          </h1>
          <div className={g.acts} data-gate-rv="">
            <Link ref={guest} className={cn(s.btn, s.pri, s.lg)} href="/app">
              {GATE.guest}
            </Link>
            <button className={cn(s.btn, s.lg, g.off)} type="button" disabled>
              {GATE.signIn}
            </button>
          </div>
          <p className={g.note} data-gate-rv="">
            {GATE.note}
          </p>
        </div>
      </main>

      <StatusLine variant="gate" state={phase === "done" ? GATE.open : GATE.starting} />
    </div>
  );
}
