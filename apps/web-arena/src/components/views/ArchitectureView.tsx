"use client";

import { Pro } from "../../lib/density";
import { ArchitectureDiagram } from "../arch/ArchitectureDiagram";
import { EpochTimeline } from "../arch/EpochTimeline";
import { AmmArbSimulator } from "../arch/AmmArbSimulator";
import { AcsCalculator } from "../arch/AcsCalculator";
import { VerificationConsole } from "../arch/VerificationConsole";
import { InvariantsList } from "../arch/InvariantsList";
import { btn, page } from "../ui/kit";
import { PageHead } from "./PageHead";

const SECTIONS = [
  { id: "arch-proof", label: "Verify it yourself" },
  { id: "arch-system", label: "System" },
  { id: "arch-amm", label: "AMM math" },
  { id: "arch-acs", label: "Scoring" },
  { id: "arch-invariants", label: "Invariants" },
];

/**
 * Proof. Simple: the Rust 5-run check, rendered with the landing's hash
 * rows. Pro adds the snapshot / MCP / in-browser consoles, the
 * architecture diagram and clock, the AMM and ACS calculators and the
 * invariants.
 */
export function ArchitectureView() {
  const jump = (id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  };

  return (
    <div className={page}>
      <PageHead
        title="Proof"
        lede="The Rust engine never touches a float, a wall clock or an unordered map, so the same seed always produces the same market, byte for byte. Run it five times on this machine and compare the SHA-256 of the full state."
      >
        <Pro>
          <nav className="flex flex-wrap gap-1.5" aria-label="Sections on this page">
            {SECTIONS.map((sec) => (
              <button key={sec.id} type="button" className={btn("ghost", "sm")} onClick={() => jump(sec.id)}>
                {sec.label}
              </button>
            ))}
          </nav>
        </Pro>
      </PageHead>

      <section id="arch-proof" className="flex min-w-0 scroll-mt-20 flex-col gap-5" aria-label="Live verification">
        <VerificationConsole />
      </section>

      <Pro>
        <section id="arch-system" className="flex min-w-0 scroll-mt-20 flex-col gap-5" aria-label="System">
          <ArchitectureDiagram />
          <EpochTimeline />
        </section>

        <section id="arch-amm" className="min-w-0 scroll-mt-20" aria-label="AMM math">
          <AmmArbSimulator />
        </section>

        <section id="arch-acs" className="min-w-0 scroll-mt-20" aria-label="Scoring">
          <AcsCalculator />
        </section>

        <section id="arch-invariants" className="min-w-0 scroll-mt-20" aria-label="Invariants">
          <InvariantsList />
        </section>
      </Pro>
    </div>
  );
}
