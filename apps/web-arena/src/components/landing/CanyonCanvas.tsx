"use client";

import { useEffect, useRef, useState } from "react";
import type { CanyonScene } from "@/lib/canyon/scene";
import { useCanyon } from "@/lib/canyon/store";
import { SceneLabels } from "./SceneLabels";

/** Static film grain: SVG feTurbulence 0.9, 2 octaves (guide §3). */
const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='220' height='220'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 .9 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";
const VIGNETTE = "radial-gradient(130% 95% at 50% 45%, transparent 55%, rgba(5,6,8,.72) 100%)";
const POSTER_BG = "radial-gradient(120% 60% at 50% 46%, #18202c 0%, transparent 60%), linear-gradient(#050608, #0a0c10)";

const reducedMotion = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
  new URLSearchParams(window.location.search).has("rm");

/**
 * The Canyon, fixed full-bleed behind the page. three.js loads on the client
 * only (dynamic import); without WebGL2 `html.no-gl` shows a static poster.
 */
export function CanyonCanvas({ mode = "landing" }: { mode?: "landing" | "gate" }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [scene, setScene] = useState<CanyonScene | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let alive = true;
    let s: CanyonScene | null = null;
    const rm = reducedMotion();
    useCanyon.getState().setReducedMotion(rm);
    const noGl = () => document.documentElement.classList.add("no-gl");
    const onResize = () => s?.resize(window.innerWidth, window.innerHeight);
    const onPointer = (e: PointerEvent) =>
      s?.setPointer(e.clientX / window.innerWidth - 0.5, e.clientY / window.innerHeight - 0.5);

    import("@/lib/canyon/scene")
      .then(({ CanyonScene }) => {
        if (!alive) return;
        if (!CanyonScene.supported()) return noGl();
        try {
          s = new CanyonScene(canvas, {
            mobile: Math.min(window.innerWidth, window.innerHeight) < 700,
            reducedMotion: rm,
            mode,
          });
        } catch {
          return noGl();
        }
        s.resize(window.innerWidth, window.innerHeight);
        s.start();
        setScene(s);
        useCanyon.getState().setScene(s);
      })
      .catch(noGl);

    window.addEventListener("resize", onResize);
    window.addEventListener("pointermove", onPointer, { passive: true });
    return () => {
      alive = false;
      window.removeEventListener("resize", onResize);
      window.removeEventListener("pointermove", onPointer);
      if (s) {
        s.dispose();
        if (useCanyon.getState().scene === s) useCanyon.getState().setScene(null);
      }
      setScene(null);
    };
  }, [mode]);

  return (
    <div aria-hidden="true">
      <canvas
        ref={canvasRef}
        data-canyon={mode}
        className="fixed inset-0 z-0 block h-full w-full bg-ink [.no-gl_&]:hidden"
      />
      <div
        data-testid="canyon-poster"
        className="fixed inset-0 z-0 hidden [.no-gl_&]:block"
        style={{ background: POSTER_BG }}
      >
        <svg
          className="absolute bottom-[12vh] left-0 h-[56vh] w-full"
          viewBox="0 0 1440 500"
          preserveAspectRatio="none"
          fill="none"
        >
          <path d="M0 40h90v50h90v45h90v50h90v55h90v60h90v70h90v90h60" stroke="#45E0BC" strokeOpacity=".7" />
          <path d="M1440 30h-90v55h-90v45h-90v55h-90v50h-90v65h-90v70h-90v90h-60" stroke="#FF5A45" strokeOpacity=".7" />
          <path d="M720 500V120" stroke="#EDEAE3" strokeOpacity=".5" strokeDasharray="2 6" />
        </svg>
      </div>
      <div className="pointer-events-none fixed inset-0 z-[1]" style={{ background: VIGNETTE }} />
      <div
        className="pointer-events-none fixed inset-0 z-[1] opacity-[.07] mix-blend-overlay"
        style={{ backgroundImage: GRAIN }}
      />
      {mode === "landing" && scene ? <SceneLabels scene={scene} /> : null}
    </div>
  );
}
