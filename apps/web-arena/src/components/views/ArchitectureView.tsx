"use client";

import { ConceptPill } from "../ui";
import { useArena } from "../../lib/arena";
import { ArchitectureDiagram } from "../arch/ArchitectureDiagram";
import { EpochTimeline } from "../arch/EpochTimeline";
import { AmmArbSimulator } from "../arch/AmmArbSimulator";
import { AcsCalculator } from "../arch/AcsCalculator";
import { VerificationConsole } from "../arch/VerificationConsole";
import { InvariantsList } from "../arch/InvariantsList";
import s from "../arch/arch.module.css";

const SECTIONS = [
  { id: "arch-system", label: "System" },
  { id: "arch-proof", label: "Verify it yourself" },
  { id: "arch-amm", label: "AMM math" },
  { id: "arch-acs", label: "Scoring" },
  { id: "arch-invariants", label: "Invariants" },
];

export function ArchitectureView() {
  const { frame, determinism } = useArena();

  const jump = (id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  };

  return (
    <div className={s.page}>
      <header className={s.hero}>
        <div className="stack" style={{ ["--gap" as string]: "12px" }}>
          <h1 className="h2">Architecture and determinism proof</h1>
          <p className="lead">
            A Rust engine that never touches a float, a wall clock or an unordered map — so the same seed always produces the same market, byte for byte.
            Explore how the pieces fit, then run the proof against the real binary.
          </p>
          <nav className="row wrap" style={{ gap: 6 }} aria-label="Sections on this page">
            {SECTIONS.map((sec) => (
              <button key={sec.id} type="button" className="btn btn-sm btn-ghost" onClick={() => jump(sec.id)}>
                {sec.label}
              </button>
            ))}
          </nav>
        </div>
        <div className={s.heroStats}>
          <div className={s.heroStat}>
            <span className="caption">
              <ConceptPill concept="fixedPoint" label="Fixed-point scale" />
            </span>
            <span className={s.heroStatValue}>10⁸ pips</span>
          </div>
          <div className={s.heroStat}>
            <span className="caption">Fast tick · macro epoch</span>
            <span className={s.heroStatValue}>10 · 1,000 ms</span>
          </div>
          <div className={s.heroStat}>
            <span className="caption">In-browser check</span>
            <span
              className={s.heroStatValue}
              style={{ color: determinism.status === "pass" ? "var(--bid)" : determinism.status === "fail" ? "var(--ask)" : "var(--text-3)" }}
              title={frame.stateHash}
            >
              {determinism.status === "pass" ? "5 / 5 equal" : determinism.status === "fail" ? "Mismatch" : determinism.status === "running" ? "Running…" : "Not run"}
            </span>
          </div>
        </div>
      </header>

      <section id="arch-system" className={s.section} aria-label="System architecture">
        <ArchitectureDiagram />
        <EpochTimeline />
      </section>

      <section id="arch-proof" className={s.section} aria-label="Live verification">
        <VerificationConsole />
      </section>

      <section id="arch-amm" className={s.section} aria-label="AMM and arbitrage math">
        <AmmArbSimulator />
      </section>

      <section id="arch-acs" className={s.section} aria-label="Scoring">
        <AcsCalculator />
      </section>

      <section id="arch-invariants" className={s.section} aria-label="Invariants">
        <InvariantsList />
      </section>
    </div>
  );
}
