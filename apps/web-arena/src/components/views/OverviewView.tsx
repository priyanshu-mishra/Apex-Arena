"use client";

import React, { useCallback, useRef, useState } from "react";
import { useArena, VIEWS, type ViewId } from "../../lib/arena";
import { Kbd } from "../ui";
import { Hero } from "../overview/Hero";
import { Tour } from "../overview/Tour";
import { prefersReducedMotion } from "../overview/shared";
import styles from "../overview/Overview.module.css";

const WORKSPACE_COPY: Record<ViewId, string> = {
  overview: "This page: what ApexArena is, a guided tour, and a live snapshot of the market.",
  arena:
    "Trade against the agents yourself. Order book ladder, CLOB vs Revm chart, order ticket, AMM swaps, arbitrage and scenario injection.",
  lab: "Configure and deploy your own agent, then watch its reasoning, fills and score next to Gemini, DeepSeek and the quant bots.",
  bench:
    "Run every agent through calm, toxic-flow, whale-shock and flash-crash stages on a fixed seed and compare their ACS.",
  arch: "How the Rust engine is built, and proof that it is deterministic: run the 5-run SHA-256 check in your browser.",
};

const STACK: { name: string; detail: string; path: string }[] = [
  {
    name: "L3 order book in Rust",
    detail: "Price-time FIFO, Cancel-Newest self-trade prevention. Prices are i64 pips at 10⁸ scale, no floats.",
    path: "crates/apex-clob",
  },
  {
    name: "revm 19.4 + alloy",
    detail: "Constant-product pool with a 30 bps fee, executed inside an in-memory EVM.",
    path: "crates/apex-evm",
  },
  {
    name: "Markov-Hawkes chaos",
    detail: "Regime switching plus self-exciting shocks, seeded with ChaCha8 for exact replay.",
    path: "crates/apex-kernel",
  },
  {
    name: "PyO3 + MCP",
    detail: "Native Python bindings and a JSON-RPC 2.0 MCP server so LLM agents can read digests and trade.",
    path: "crates/apex-py, sdks/python",
  },
  {
    name: "Next.js 15 workstation",
    detail: "React 19 UI with the simulation in a WebWorker, so the market keeps running across views.",
    path: "apps/web-arena",
  },
];

export function OverviewView() {
  const { setView } = useArena();
  const [step, setStep] = useState(0);
  const tourRef = useRef<HTMLElement | null>(null);

  const startTour = useCallback(() => {
    setStep(0);
    const el = tourRef.current;
    if (!el) return;
    el.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "start" });
    el.focus({ preventScroll: true });
  }, []);

  return (
    <div className={styles.page}>
      <Hero onStartTour={startTour} />

      <Tour step={step} onStep={setStep} sectionRef={tourRef} />

      <section aria-labelledby="workspaces-title">
        <div className={styles.sectionIntro}>
          <h2 id="workspaces-title" className={styles.sectionTitle}>
            What&apos;s inside
          </h2>
          <p className="lead">Five workspaces share one running simulation. Switching between them never resets it.</p>
        </div>
        <ul className={styles.workspaces}>
          {VIEWS.map((v) => (
            <li key={v.id} className={styles.workspaceRow}>
              <Kbd>{v.key}</Kbd>
              <span className={styles.workspaceName}>{v.label}</span>
              <span className={styles.workspaceDesc}>{WORKSPACE_COPY[v.id]}</span>
              {v.id === "overview" ? (
                <span className="caption">You are here</span>
              ) : (
                <button type="button" className="btn btn-sm" onClick={() => setView(v.id)}>
                  Open {v.short.toLowerCase()}
                </button>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="stack-title">
        <div className={styles.sectionIntro}>
          <h2 id="stack-title" className={styles.sectionTitle}>
            Built on
          </h2>
          <p className="lead">
            The browser runs a faithful port of the engine. The reference implementation is a Rust workspace whose
            seed-42 runs must hash identically five times in a row.
          </p>
        </div>
        <div className={styles.stack}>
          {STACK.map((s) => (
            <div key={s.name} className={styles.stackItem}>
              <span className={styles.stackName}>{s.name}</span>
              <span className={styles.stackDetail}>{s.detail}</span>
              <span className={styles.stackPath}>{s.path}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
