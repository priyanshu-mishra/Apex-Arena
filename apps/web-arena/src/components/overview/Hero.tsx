"use client";

import React, { useMemo } from "react";
import { agentKind, displayAgentName, useArena } from "../../lib/arena";
import { Badge, Kbd } from "../ui";
import styles from "./Overview.module.css";
import { Sparkline, TICKS_PER_EPOCH, fmtAcs, fmtBps, lambdaOf } from "./shared";

const WINDOW = 240;

export function Hero({ onStartTour }: { onStartTour: () => void }) {
  const { setView } = useArena();

  return (
    <section className={styles.hero} aria-labelledby="overview-hero-title">
      <div className={styles.heroCopy}>
        <h1 id="overview-hero-title" className={styles.heroTitle}>
          A live market where trading agents are tested by the market itself.
        </h1>
        <p className={styles.heroLead}>
          ApexArena runs an order book and an on-chain AMM side by side, lets a chaos engine push them through calm
          days, droughts and flash crashes, and scores every agent on how it survives, not on how lucky it got.{" "}
          <strong>Every run is deterministic</strong>: in the Rust engine the same seed produces the same SHA-256 state hash, so a
          result can be replayed and audited.
        </p>
        <div className={styles.ctaRow}>
          <button type="button" className="btn btn-lg btn-primary" onClick={onStartTour}>
            Start the 60-second tour
          </button>
          <button type="button" className="btn btn-lg" onClick={() => setView("arena")}>
            Open the live arena
          </button>
        </div>
        <div className={styles.keyHints} aria-label="Keyboard shortcuts">
          <span>
            <Kbd>1</Kbd>–<Kbd>5</Kbd> switch workspaces
          </span>
          <span>
            <Kbd>⌘K</Kbd> command palette
          </span>
          <span>
            <Kbd>Space</Kbd> pause the simulation
          </span>
        </div>
      </div>
      <GlanceCard />
    </section>
  );
}

function GlanceCard() {
  const { frame, history, paused } = useArena();
  const recent = useMemo(() => history.slice(-WINDOW), [history]);
  const clob = useMemo(() => recent.map((p) => p.clobMidUsd), [recent]);
  const revm = useMemo(() => recent.map((p) => p.evmSpotUsd), [recent]);

  const leader = frame.leaderboard[0];
  const lambda = lambdaOf(frame);
  const epoch = Math.floor(frame.tick / TICKS_PER_EPOCH);
  const basisTone = Math.abs(frame.basisBps) >= 34 ? "var(--chaos)" : "var(--text)";

  return (
    <aside className={styles.glance} aria-label="Market at a glance, updating live">
      <div className={styles.glanceHead}>
        <span className={styles.glanceTitle}>
          <span className={styles.liveDot} data-paused={paused} aria-hidden />
          ETH / USDT right now
        </span>
        <Badge tone="regime">{frame.regime.toLowerCase()}</Badge>
      </div>

      <div className={styles.glancePrices}>
        <span className={styles.priceLabel}>
          <span className={styles.swatch} style={{ background: "var(--text-2)" }} aria-hidden />
          Order book mid
        </span>
        <span className={styles.priceLabel}>
          <span className={styles.swatch} style={{ background: "var(--evm)" }} aria-hidden />
          Revm pool spot
        </span>
        <span className={styles.priceBig}>{frame.clobMidFormatted}</span>
        <span className={styles.priceBig} style={{ color: "var(--evm)" }}>
          {frame.evmSpotFormatted}
        </span>
      </div>

      <div className={styles.glanceChart}>
        <Sparkline
          ariaLabel={`Last ${recent.length} ticks of CLOB mid and Revm spot`}
          height={120}
          series={[
            { values: clob, color: "var(--text-2)", strokeWidth: 1.75 },
            { values: revm, color: "var(--evm)", strokeWidth: 1.5 },
          ]}
        />
      </div>

      <div className={styles.glanceStats}>
        <div className={styles.glanceStat}>
          <span className={styles.statValue} style={{ color: basisTone }}>
            {fmtBps(frame.basisBps, 0)}
          </span>
          <span className={styles.statLabel}>Basis between venues</span>
        </div>
        <div className={styles.glanceStat}>
          <span className={styles.statValue}>{lambda.toFixed(3)}</span>
          <span className={styles.statLabel}>Shock intensity λ(t)</span>
        </div>
        <div className={styles.glanceStat}>
          <span className={styles.statValue}>{frame.spreadBps} bps</span>
          <span className={styles.statLabel}>Book spread</span>
        </div>
        <div className={styles.glanceStat}>
          <span className={styles.statValue}>{frame.tick.toLocaleString("en-US")}</span>
          <span className={styles.statLabel}>
            Tick, epoch <span className="num">{epoch}</span>
          </span>
        </div>
      </div>

      <div className={styles.glanceFoot}>
        {leader ? (
          <span className="row wrap" style={{ ["--gap" as string]: "8px" }}>
            Leading on ACS
            <span className={styles.leaderName}>{displayAgentName(leader.agentId)}</span>
            <Badge tone={agentKind(leader.badge).tone}>{agentKind(leader.badge).label}</Badge>
            <span className="num text-1">{fmtAcs(leader.acsScoreBps)}</span>
          </span>
        ) : (
          <span>Agents are warming up</span>
        )}
        <span>{paused ? "Paused" : "Simulated in your browser, seed 42"}</span>
      </div>
    </aside>
  );
}
