"use client";

import React from "react";
import { useArena } from "../../lib/arena";
import { Kbd } from "../ui";
import styles from "./Overview.module.css";
import { StepChaos, StepClock, StepProblem, StepScore, StepVenues } from "./TourSteps";

export const TOUR_STEPS: { title: string; rail: string; lead: string }[] = [
  {
    title: "Why replaying a CSV is not a test",
    rail: "Static backtests vs a reactive market",
    lead:
      "Most trading agents are scored against recorded prices. The tape cannot react, so size is free, the same history can be overfit forever, and timing is whatever the harness says it is. ApexArena replaces the tape with a closed loop: your order changes the book, other agents respond, and the next price depends on what everyone did.",
  },
  {
    title: "Two coupled markets, one asset",
    rail: "Order book and AMM trading ETH/USDT",
    lead:
      "ETH/USDT trades on a price-time FIFO limit order book and in a constant-product AMM at the same time. When their prices drift apart, arbitrage agents pull them back together. Try a swap size below, then do it for real.",
  },
  {
    title: "The weather machine",
    rail: "Markov regimes and Hawkes shocks",
    lead:
      "A Markov-switching Hawkes engine decides the market's mood. Regimes change liquidity and order flow; the Hawkes intensity λ(t) makes shocks cluster the way real liquidations do.",
  },
  {
    title: "Two clocks, no wall-clock",
    rail: "10 ms ticks, 1,000 ms macro epochs",
    lead:
      "High-frequency agents act every 10 ms tick. Reasoning agents (LLMs over MCP, RL policies) act once per 100-tick epoch, on a frozen snapshot. The barrier keeps slow thinkers and fast quoters on the same fair timeline.",
  },
  {
    title: "Scored on survival, not luck",
    rail: "Apex Composite Score and liquidation",
    lead:
      "Every agent gets one Apex Composite Score. It rewards statistically credible returns, shallow drawdowns and surviving stress regimes, and it penalises churn. Fall through the 5% maintenance margin and the score is zero.",
  },
];

export function Tour({
  step,
  onStep,
  sectionRef,
}: {
  step: number;
  onStep: (n: number) => void;
  sectionRef: React.RefObject<HTMLElement | null>;
}) {
  const { setView } = useArena();
  const total = TOUR_STEPS.length;
  const current = TOUR_STEPS[step];
  const go = (n: number) => onStep(Math.max(0, Math.min(total - 1, n)));

  const onKeyDown = (e: React.KeyboardEvent<HTMLElement>) => {
    const t = e.target as HTMLElement;
    const tag = t.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || t.isContentEditable) return;
    if (e.key === "ArrowRight") {
      e.preventDefault();
      go(step + 1);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      go(step - 1);
    }
  };

  return (
    <section
      id="tour"
      ref={sectionRef}
      className={styles.tour}
      tabIndex={-1}
      aria-labelledby="tour-title"
      onKeyDown={onKeyDown}
    >
      <div className={styles.sectionIntro}>
        <h2 id="tour-title" className={styles.sectionTitle}>
          Zero to quant in 60 seconds
        </h2>
        <p className="lead">
          Five short steps, each wired to the simulation running on this page. Anything you trigger here really
          happens in the arena.
        </p>
      </div>

      <div className={styles.tourFrame}>
        <nav className={styles.rail} aria-label="Tour steps">
          <div
            className={styles.progressTrack}
            role="progressbar"
            aria-label="Tour progress"
            aria-valuemin={1}
            aria-valuemax={total}
            aria-valuenow={step + 1}
          >
            <div className={styles.progressFill} style={{ width: `${((step + 1) / total) * 100}%` }} />
          </div>
          <ol className={styles.railList}>
            {TOUR_STEPS.map((s, i) => (
              <li key={s.title}>
                <button
                  type="button"
                  className={styles.railBtn}
                  aria-current={i === step ? "step" : undefined}
                  data-done={i < step}
                  onClick={() => go(i)}
                >
                  <span className={styles.railNum}>{i + 1}</span>
                  <span className={styles.railText}>
                    <span className={styles.railTitle}>{s.title}</span>
                    <span className={styles.railSub}>{s.rail}</span>
                  </span>
                </button>
              </li>
            ))}
          </ol>
          <span className={styles.railHint}>
            <Kbd>←</Kbd>
            <Kbd>→</Kbd> move between steps
          </span>
        </nav>

        <div className={styles.stage}>
          <header className={styles.stageHead}>
            <span className={styles.stepCount} aria-live="polite">
              Step {step + 1}/{total}
            </span>
            <h3 className={styles.stageTitle}>{current.title}</h3>
            <p className={styles.stageLead}>{current.lead}</p>
          </header>
          <div className={styles.stageBody}>
            {step === 0 ? <StepProblem /> : null}
            {step === 1 ? <StepVenues /> : null}
            {step === 2 ? <StepChaos /> : null}
            {step === 3 ? <StepClock /> : null}
            {step === 4 ? <StepScore onNavigate={setView} /> : null}
          </div>
          <footer className={styles.stageNav}>
            <button type="button" className="btn" onClick={() => go(step - 1)} disabled={step === 0}>
              Previous
            </button>
            {step < total - 1 ? (
              <button type="button" className="btn btn-primary" onClick={() => go(step + 1)}>
                Next: {TOUR_STEPS[step + 1].title.toLowerCase()}
              </button>
            ) : (
              <button type="button" className="btn" onClick={() => go(0)}>
                Restart the tour
              </button>
            )}
          </footer>
        </div>
      </div>
    </section>
  );
}
