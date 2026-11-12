"use client";

import React, { useMemo, useState } from "react";
import {
  MAINTENANCE_MARGIN_PCT,
  agentKind,
  displayAgentName,
  fmtUsd,
  regimeTone,
  useArena,
  type ViewId,
} from "../../lib/arena";
import type { MarketRegimeLabel } from "../../lib/sharedBuffer";
import { Badge, ConceptPill } from "../ui";
import styles from "./Overview.module.css";
import {
  FAST_TICK_MS,
  LabeledRange,
  POOL_FEE,
  Sparkline,
  TICKS_PER_EPOCH,
  fmtAcs,
  fmtBps,
  fmtPct,
  lambdaOf,
} from "./shared";

/* ==========================================================================
 * Step 1 — The problem: static replay vs reactive arena
 * ======================================================================== */
export function StepProblem() {
  const { frame, actions } = useArena();
  const [qty, setQty] = useState(40);

  const asks = useMemo(
    () => [...frame.asks].filter((l) => l.qtyEth > 0).sort((a, b) => a.priceUsd - b.priceUsd).slice(0, 8),
    [frame.asks]
  );
  const walk = useMemo(() => {
    let remaining = qty;
    let cost = 0;
    let lastPrice = asks[0]?.priceUsd ?? frame.clobMidUsd;
    const eaten: number[] = [];
    for (const lvl of asks) {
      const take = Math.min(remaining, lvl.qtyEth);
      eaten.push(take);
      if (take > 0) {
        cost += take * lvl.priceUsd;
        lastPrice = lvl.priceUsd;
      }
      remaining -= take;
    }
    const filled = qty - Math.max(0, remaining);
    const vwap = filled > 0 ? cost / filled : frame.clobMidUsd;
    const slipBps = frame.clobMidUsd > 0 ? ((vwap - frame.clobMidUsd) / frame.clobMidUsd) * 10000 : 0;
    return { eaten, filled, vwap, slipBps, unfilled: Math.max(0, remaining), lastPrice };
  }, [asks, qty, frame.clobMidUsd]);

  const maxLevel = Math.max(1, ...asks.map((l) => l.qtyEth));
  const tapeCost = qty * frame.clobMidUsd;
  const realCost = walk.filled * walk.vwap;
  const hiddenCost = walk.filled > 0 ? realCost - walk.filled * frame.clobMidUsd : 0;

  return (
    <div>
      <ul className={styles.failList}>
        <li className={styles.failItem}>
          <strong>Zero price impact</strong>
          <span>A CSV replay fills any size at the recorded price. Real orders eat through the book and move it.</span>
        </li>
        <li className={styles.failItem}>
          <strong>Overfitting to one tape</strong>
          <span>Tune long enough against a fixed history and the agent memorises it. The score stops meaning anything.</span>
        </li>
        <li className={styles.failItem}>
          <strong>Wall-clock leaks</strong>
          <span>A slow model trades on stale prices, a fast one on prices it could not have seen yet. Neither is fair.</span>
        </li>
      </ul>

      <div className="stack" style={{ ["--gap" as string]: "16px" }}>
        <LabeledRange
          label="Your market buy order"
          value={qty}
          display={`${qty} ETH`}
          min={1}
          max={200}
          step={1}
          onChange={setQty}
        />
        <div className={styles.split}>
          <div className={styles.inset} data-tone="bad">
            <span className={styles.insetTitle}>Static replay</span>
            <div className={styles.readout}>
              <div className={styles.readoutItem}>
                <span className={styles.readoutValue}>{fmtUsd(frame.clobMidUsd)}</span>
                <span className="caption">Average fill, same as the tape</span>
              </div>
              <div className={styles.readoutItem}>
                <span className={styles.readoutValue}>0.0 bps</span>
                <span className="caption">Slippage</span>
              </div>
            </div>
            <Sparkline
              ariaLabel="A recorded price tape that does not react to your order"
              height={70}
              series={[{ values: STATIC_TAPE, color: "var(--text-4)", dash: "4 4" }]}
            />
            <p className={styles.insetNote}>
              Cost {fmtUsd(tapeCost, 0)}. Nobody notices your order, nobody re-quotes, the next price is already
              written down.
            </p>
          </div>

          <div className={styles.inset}>
            <span className={styles.insetTitle}>ApexArena, against the live book</span>
            <div className={styles.readout}>
              <div className={styles.readoutItem}>
                <span className={styles.readoutValue}>{fmtUsd(walk.vwap)}</span>
                <span className="caption">Average fill</span>
              </div>
              <div className={styles.readoutItem}>
                <span className={styles.readoutValue} style={{ color: walk.slipBps > 0.5 ? "var(--ask)" : undefined }}>
                  {walk.slipBps.toFixed(1)} bps
                </span>
                <span className="caption">Slippage vs mid</span>
              </div>
            </div>
            <div className={styles.ladder} aria-label="Ask levels consumed by your order">
              {asks.map((lvl, i) => (
                <div className={styles.ladderRow} key={lvl.pricePips}>
                  <span>{lvl.priceUsd.toFixed(2)}</span>
                  <span className={styles.ladderBar}>
                    <span className={styles.ladderFill} style={{ width: `${(lvl.qtyEth / maxLevel) * 100}%` }} />
                    <span
                      className={styles.ladderEaten}
                      style={{ width: `${((walk.eaten[i] ?? 0) / maxLevel) * 100}%` }}
                    />
                  </span>
                  <span style={{ textAlign: "right" }}>{lvl.qtyEth.toFixed(2)}</span>
                </div>
              ))}
              {asks.length === 0 ? <span className="caption">Waiting for the book to fill.</span> : null}
            </div>
            <p className={styles.insetNote}>
              {walk.unfilled > 0
                ? `${walk.unfilled.toFixed(2)} ETH is beyond the top ${asks.length} levels and would sweep deeper. `
                : null}
              Impact costs {fmtUsd(Math.max(0, hiddenCost), 0)} that the replay never charged. Makers then see the
              sweep and widen their quotes.
            </p>
            <div>
              <button
                type="button"
                className="btn btn-sm btn-bid"
                disabled={asks.length === 0}
                onClick={() => actions.submitOrder("BID", "IOC", Number(walk.lastPrice.toFixed(2)), qty)}
              >
                Send this buy to the live book
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const STATIC_TAPE = Array.from({ length: 60 }, (_, i) => 100 + Math.sin(i / 5) * 0.6 + Math.sin(i / 2.3) * 0.25);

/* ==========================================================================
 * Step 2 — Two coupled markets
 * ======================================================================== */
export function StepVenues() {
  const { frame, actions } = useArena();
  const [size, setSize] = useState(120);
  const [dir, setDir] = useState<"sell" | "buy">("sell");

  const x = frame.evmReserveBaseEth;
  const y = frame.evmReserveQuoteUsdt;
  const k = x * y;

  const sim = useMemo(() => {
    if (!(x > 0 && y > 0)) return null;
    let x1: number;
    let y1: number;
    let execPrice: number;
    if (dir === "sell") {
      // ETH in → USDT out. Fee is taken from the input.
      const net = size * (1 - POOL_FEE);
      const out = (y * net) / (x + net);
      x1 = x + size;
      y1 = y - out;
      execPrice = out / size;
    } else {
      // Buy `size` ETH out of the pool, paying USDT in.
      const eth = Math.min(size, x * 0.9);
      const inNet = (y * eth) / (x - eth);
      const inGross = inNet / (1 - POOL_FEE);
      x1 = x - eth;
      y1 = y + inGross;
      execPrice = inGross / eth;
    }
    const spot1 = y1 / x1;
    const basis1 = ((frame.clobMidUsd - spot1) / spot1) * 10000;
    const impactBps = ((spot1 - frame.evmSpotUsd) / frame.evmSpotUsd) * 10000;
    return { x1, y1, spot1, basis1, impactBps, execPrice };
  }, [x, y, size, dir, frame.clobMidUsd, frame.evmSpotUsd]);

  return (
    <div className={styles.splitWide}>
      <div className="stack" style={{ ["--gap" as string]: "20px" }}>
        <div className={styles.readout}>
          <div className={styles.readoutItem}>
            <span className={styles.readoutValue}>{frame.clobMidFormatted}</span>
            <span className="caption">CLOB mid, price-time FIFO book</span>
          </div>
          <div className={styles.readoutItem}>
            <span className={styles.readoutValue} style={{ color: "var(--evm)" }}>
              {frame.evmSpotFormatted}
            </span>
            <span className="caption">Revm pool spot, y / x</span>
          </div>
          <div className={styles.readoutItem}>
            <span className={styles.readoutValue}>{fmtBps(frame.basisBps, 0)}</span>
            <span className="caption">
              <ConceptPill concept="basis" label="Basis" />
            </span>
          </div>
        </div>

        <div className={styles.inset}>
          <div className="row-between wrap">
            <span className={styles.insetTitle}>What would a swap do to the pool?</span>
            <div className="segmented" role="group" aria-label="Swap direction">
              <button type="button" aria-pressed={dir === "sell"} onClick={() => setDir("sell")}>
                Sell ETH
              </button>
              <button type="button" aria-pressed={dir === "buy"} onClick={() => setDir("buy")}>
                Buy ETH
              </button>
            </div>
          </div>
          <LabeledRange
            label="Swap size"
            value={size}
            display={`${size} ETH`}
            min={5}
            max={600}
            step={5}
            onChange={setSize}
            accent="var(--evm)"
          />
          {sim ? (
            <div className={styles.readout}>
              <div className={styles.readoutItem}>
                <span className={styles.readoutValueSm}>{fmtUsd(sim.execPrice)}</span>
                <span className="caption">Average price after 30 bps fee</span>
              </div>
              <div className={styles.readoutItem}>
                <span className={styles.readoutValueSm} style={{ color: "var(--evm)" }}>
                  {fmtUsd(sim.spot1)}
                </span>
                <span className="caption">New pool spot ({fmtBps(sim.impactBps, 0)})</span>
              </div>
              <div className={styles.readoutItem}>
                <span
                  className={styles.readoutValueSm}
                  style={{ color: Math.abs(sim.basis1) > 34 ? "var(--chaos)" : undefined }}
                >
                  {fmtBps(sim.basis1, 0)}
                </span>
                <span className="caption">Resulting basis</span>
              </div>
            </div>
          ) : (
            <span className="caption">Pool reserves are loading.</span>
          )}
          <p className={styles.insetNote}>
            Computed here from the live reserves. Once basis passes the ~34 bps round-trip cost, arbitrage agents
            buy the cheap venue and sell the rich one until the two prices meet again.
          </p>
          <div className="row wrap" style={{ ["--gap" as string]: "10px" }}>
            <button type="button" className="btn btn-evm" onClick={() => actions.injectScenario("whale-dump")}>
              Dump 450 ETH on the pool for real
            </button>
            <span className="caption">Then watch the basis above open and close.</span>
          </div>
        </div>
      </div>

      <div className={styles.inset}>
        <div className="row-between wrap">
          <span className={styles.insetTitle}>The x · y = k curve</span>
          <ConceptPill concept="invariantK" label="Invariant" align="right" />
        </div>
        <CurveChart x0={x} y0={y} k={k} x1={sim?.x1} y1={sim?.y1} />
        <p className={styles.insetNote}>
          <span className="num">{x.toLocaleString("en-US", { maximumFractionDigits: 1 })}</span> ETH ×{" "}
          <span className="num">{y.toLocaleString("en-US", { maximumFractionDigits: 0 })}</span> USDT. Every swap slides
          the pool along this hyperbola, so larger trades pay progressively worse prices. In the Rust engine the swap
          executes inside revm; this browser demo mirrors the same integer math.
        </p>
      </div>
    </div>
  );
}

function CurveChart({ x0, y0, k, x1, y1 }: { x0: number; y0: number; k: number; x1?: number; y1?: number }) {
  const W = 320;
  const H = 210;
  const P = 28;
  if (!(x0 > 0 && y0 > 0)) {
    return <div className="empty">Waiting for pool reserves.</div>;
  }
  const xMin = x0 * 0.5;
  const xMax = x0 * 1.7;
  const yMin = k / xMax;
  const yMax = k / xMin;
  const sx = (v: number) => P + ((v - xMin) / (xMax - xMin)) * (W - P * 1.5);
  const sy = (v: number) => H - P - ((v - yMin) / (yMax - yMin)) * (H - P * 1.6);
  const pts: string[] = [];
  for (let i = 0; i <= 60; i++) {
    const xv = xMin + ((xMax - xMin) * i) / 60;
    pts.push(`${i === 0 ? "M" : "L"}${sx(xv).toFixed(1)},${sy(k / xv).toFixed(1)}`);
  }
  const hasAfter = x1 !== undefined && y1 !== undefined && x1 > xMin && x1 < xMax;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={styles.svgBlock} role="img" aria-label="Constant-product curve with the current pool state and the simulated swap">
      <line x1={P} y1={H - P} x2={W - P / 2} y2={H - P} stroke="var(--border-strong)" />
      <line x1={P} y1={P / 2} x2={P} y2={H - P} stroke="var(--border-strong)" />
      <text x={W - P / 2} y={H - 8} textAnchor="end" className={styles.svgText}>
        ETH reserve x
      </text>
      <text x={P + 6} y={P / 2 + 4} className={styles.svgText}>
        USDT reserve y
      </text>
      <path d={pts.join(" ")} fill="none" stroke="var(--evm)" strokeWidth={2} opacity={0.6} />
      {hasAfter ? (
        <line
          x1={sx(x0)}
          y1={sy(y0)}
          x2={sx(x1!)}
          y2={sy(Math.max(yMin, Math.min(yMax, y1!)))}
          stroke="var(--text-3)"
          strokeDasharray="3 3"
        />
      ) : null}
      <circle cx={sx(x0)} cy={sy(y0)} r={6} fill="var(--evm)" stroke="var(--bg)" strokeWidth={2} />
      <text x={sx(x0) + 10} y={sy(y0) - 8} className={styles.svgTextStrong}>
        now
      </text>
      {hasAfter ? (
        <>
          <circle cx={sx(x1!)} cy={sy(Math.max(yMin, Math.min(yMax, y1!)))} r={5} fill="var(--text)" stroke="var(--bg)" strokeWidth={2} />
          <text x={sx(x1!) + 9} y={sy(Math.max(yMin, Math.min(yMax, y1!))) + 16} className={styles.svgText}>
            after swap
          </text>
        </>
      ) : null}
    </svg>
  );
}

/* ==========================================================================
 * Step 3 — The weather machine
 * ======================================================================== */
const REGIME_NODES: { id: MarketRegimeLabel; x: number; y: number; desc: string }[] = [
  { id: "CALM", x: 20, y: 20, desc: "Tight spreads, deep book" },
  { id: "TRENDING", x: 320, y: 20, desc: "Directional flow" },
  { id: "LIQUIDITY DROUGHT", x: 320, y: 150, desc: "Makers pull quotes" },
  { id: "FLASH CRASH", x: 20, y: 150, desc: "Cascading sells" },
];
const NODE_W = 180;
const NODE_H = 58;

export function StepChaos() {
  const { frame, history, actions } = useArena();
  const lambda = lambdaOf(frame);
  const series = useMemo(() => history.slice(-300).map((p) => p.hawkesIntensity ?? 0), [history]);
  const peak = series.length ? Math.max(...series) : lambda;

  return (
    <div className={styles.splitWide}>
      <div className={styles.inset}>
        <div className="row-between wrap">
          <span className={styles.insetTitle}>Four regimes, one live state</span>
          <span className="caption">Select a regime to force it</span>
        </div>
        <div className={styles.diagramScroll}>
        <svg viewBox="0 0 520 230" className={styles.svgBlock} style={{ minWidth: 520 }} role="group" aria-label="Markov regime state diagram">
          <defs>
            <marker id="ov-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M0,0 L10,5 L0,10 z" fill="var(--text-4)" />
            </marker>
          </defs>
          <g stroke="var(--text-4)" strokeWidth={1.5} fill="none" markerEnd="url(#ov-arrow)">
            <line x1={204} y1={49} x2={316} y2={49} />
            <line x1={410} y1={82} x2={410} y2={146} />
            <line x1={316} y1={179} x2={204} y2={179} />
            <line x1={110} y1={146} x2={110} y2={82} />
          </g>
          <text x={260} y={40} textAnchor="middle" className={styles.svgText}>momentum</text>
          <text x={420} y={118} className={styles.svgText}>thinning</text>
          <text x={260} y={200} textAnchor="middle" className={styles.svgText}>cascade</text>
          <text x={100} y={118} textAnchor="end" className={styles.svgText}>decay</text>
          {REGIME_NODES.map((n) => {
            const active = frame.regime === n.id;
            const color = `var(--${regimeTone(n.id)})`;
            return (
              <g
                key={n.id}
                className={styles.regimeNode}
                role="button"
                tabIndex={0}
                aria-pressed={active}
                aria-label={`Force regime ${n.id.toLowerCase()}`}
                onClick={() => actions.setRegime(n.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    actions.setRegime(n.id);
                  }
                }}
              >
                <rect
                  x={n.x}
                  y={n.y}
                  width={NODE_W}
                  height={NODE_H}
                  rx={10}
                  fill={active ? color : "var(--surface-2)"}
                  fillOpacity={active ? 0.16 : 1}
                  stroke={active ? color : "var(--border-strong)"}
                  strokeWidth={active ? 2 : 1}
                />
                <circle cx={n.x + 16} cy={n.y + 22} r={4} fill={color} />
                <text x={n.x + 28} y={n.y + 26} className={styles.svgTextStrong}>
                  {n.id.charAt(0) + n.id.slice(1).toLowerCase()}
                </text>
                <text x={n.x + 16} y={n.y + 45} className={styles.svgText}>
                  {n.desc}
                </text>
              </g>
            );
          })}
        </svg>
        </div>
        <p className={styles.insetNote}>
          A Markov chain decides which regime the market is in; transitions are probabilistic and a big enough shock
          can jump straight to a crash. Each regime changes how the background agents quote and trade.
        </p>
      </div>

      <div className={styles.inset}>
        <div className="row-between wrap">
          <span className={styles.insetTitle}>Shock intensity</span>
          <ConceptPill concept="hawkes" label="λ(t) formula" align="right" />
        </div>
        <div className={styles.readout}>
          <div className={styles.readoutItem}>
            <span className={styles.readoutValue} style={{ color: lambda > 1.5 ? "var(--ask)" : lambda > 0.6 ? "var(--chaos)" : undefined }}>
              {lambda.toFixed(3)}
            </span>
            <span className="caption">λ(t) now</span>
          </div>
          <div className={styles.readoutItem}>
            <span className={styles.readoutValueSm}>{peak.toFixed(3)}</span>
            <span className="caption">Peak, last 300 ticks</span>
          </div>
        </div>
        <Sparkline
          ariaLabel="Hawkes intensity over the last 300 ticks"
          height={90}
          series={[{ values: series, color: "var(--chaos)" }]}
          baseline={{ value: 0.2, color: "var(--text-4)" }}
          fillFirst
        />
        <p className={styles.insetNote}>
          Self-excitation: every shock raises the odds of the next one, then fades exponentially. The dashed line is
          the calm baseline μ = 0.2.
        </p>
        <div className="row wrap" style={{ ["--gap" as string]: "8px" }}>
          <button type="button" className="btn btn-danger" onClick={() => actions.injectScenario("flash-crash")}>
            Trigger a flash crash
          </button>
          <button type="button" className="btn btn-chaos" onClick={() => actions.injectScenario("toxic-flow")}>
            Inject toxic flow
          </button>
        </div>
      </div>
    </div>
  );
}

/* ==========================================================================
 * Step 4 — Dual-speed synchronization
 * ======================================================================== */
export function StepClock() {
  const { frame, paused, actions } = useArena();
  const phase = frame.tick % TICKS_PER_EPOCH;
  const epoch = Math.floor(frame.tick / TICKS_PER_EPOCH);
  const until = TICKS_PER_EPOCH - phase;
  const virtualNs = BigInt(frame.tick) * BigInt(FAST_TICK_MS * 1_000_000);
  const trace = frame.reasoningTraces[0];

  return (
    <div className="stack" style={{ ["--gap" as string]: "24px" }}>
      <div className={styles.readout}>
        <div className={styles.readoutItem}>
          <span className={styles.readoutValue}>{frame.tick.toLocaleString("en-US")}</span>
          <span className="caption">Fast tick</span>
        </div>
        <div className={styles.readoutItem}>
          <span className={styles.readoutValue}>{epoch.toLocaleString("en-US")}</span>
          <span className="caption">Macro epoch</span>
        </div>
        <div className={styles.readoutItem}>
          <span className={styles.readoutValue} style={{ color: "#c084fc" }}>
            {until}
          </span>
          <span className="caption">Ticks until the next digest</span>
        </div>
        <div className={styles.readoutItem}>
          <span className={styles.readoutValueSm} style={{ lineHeight: "33px" }}>
            {virtualNs.toLocaleString("en-US")}
          </span>
          <span className="caption">virtual_ts_ns</span>
        </div>
      </div>

      <div className="stack" style={{ ["--gap" as string]: "12px" }}>
        <div className={styles.lane}>
          <span className={styles.laneLabel}>
            Fast loop
            <small>
              <span className="num">10</span> ms per tick
            </small>
          </span>
          <div
            className={styles.tickCells}
            role="meter"
            aria-label="Position inside the current macro epoch"
            aria-valuemin={0}
            aria-valuemax={TICKS_PER_EPOCH}
            aria-valuenow={phase}
          >
            {Array.from({ length: TICKS_PER_EPOCH }, (_, i) => (
              <span
                key={i}
                className={styles.tickCell}
                data-state={i === TICKS_PER_EPOCH - 1 ? "digest" : i < phase ? "past" : i === phase ? "now" : "future"}
              />
            ))}
          </div>
        </div>
        <div className={styles.lane}>
          <span className={styles.laneLabel}>
            Macro epoch
            <small>
              <span className="num">1,000</span> ms, <span className="num">100</span> ticks
            </small>
          </span>
          <div className={styles.epochBar}>MacroDigest: arena freezes, LLM and MCP agents act</div>
        </div>
      </div>

      <div className={styles.split}>
        <div className={styles.inset}>
          <span className={styles.insetTitle}>What happens at the barrier</span>
          <p className={styles.insetNote}>
            Every 10 ms tick matches CLOB orders, executes revm swaps, steps the background ecology (value, momentum,
            Avellaneda-Stoikov makers, noise) and updates λ(t). On tick 100 the arena stops, compiles a{" "}
            <ConceptPill concept="macroDigest" label="MacroDigest" />, hands it to the reasoning agents, applies their
            batch orders and resumes.
          </p>
          <p className={styles.insetNote}>
            Time only advances through <span className="mono text-2">virtual_ts_ns</span>. Nothing reads the system
            clock, so a model that takes 4 seconds to answer sees exactly what a model that takes 40 ms sees.
          </p>
          <div className="row wrap" style={{ ["--gap" as string]: "8px" }}>
            <button type="button" className="btn btn-sm" onClick={actions.togglePause}>
              {paused ? "Resume" : "Pause"}
            </button>
            <button type="button" className="btn btn-sm" onClick={() => actions.step(1)}>
              Step 1 tick
            </button>
            <button type="button" className="btn btn-sm" onClick={() => actions.step(until)}>
              Jump to the next digest
            </button>
          </div>
        </div>
        <div className={styles.inset}>
          <span className={styles.insetTitle}>Latest reasoning-agent response</span>
          {trace ? (
            <>
              <div className="row wrap" style={{ ["--gap" as string]: "8px" }}>
                <Badge tone="llm">{trace.agentId}</Badge>
                <span className="caption">
                  tick <span className="num">{trace.tick.toLocaleString("en-US")}</span>, regime{" "}
                  {trace.regime.toLowerCase()}
                </span>
              </div>
              <p className={styles.traceQuote}>{trace.thoughtSummary}</p>
              <code className="code-inline" style={{ overflowWrap: "anywhere" }}>
                {trace.toolAction}
              </code>
            </>
          ) : (
            <p className={styles.insetNote}>The first digest arrives at tick 100.</p>
          )}
        </div>
      </div>
    </div>
  );
}

/* ==========================================================================
 * Step 5 — ACS and instant liquidation
 * ======================================================================== */
const PRESETS = {
  lucky: { psr: 0.38, calmar: 0.22, ood: 0.1, turnover: 0.7, breach: true },
  robust: { psr: 0.91, calmar: 0.68, ood: 0.86, turnover: 0.18, breach: false },
} as const;

export function StepScore({ onNavigate }: { onNavigate: (v: ViewId) => void }) {
  const { frame } = useArena();
  const [psr, setPsr] = useState(0.72);
  const [calmar, setCalmar] = useState(0.5);
  const [ood, setOod] = useState(0.6);
  const [turnover, setTurnover] = useState(0.25);
  const [breach, setBreach] = useState(false);

  const parts = [
    { key: "psr", label: "0.40 × PSR(0)", value: 0.4 * psr, color: "var(--bid)" },
    { key: "calmar", label: "0.30 × Calmar", value: 0.3 * calmar, color: "var(--evm)" },
    { key: "ood", label: "0.20 × Survival", value: 0.2 * ood, color: "var(--llm)" },
  ];
  const penalty = 0.1 * turnover;
  const raw = parts.reduce((s, p) => s + p.value, 0) - penalty;
  const acs = breach ? 0 : Math.max(0, raw);

  const apply = (p: (typeof PRESETS)[keyof typeof PRESETS]) => {
    setPsr(p.psr);
    setCalmar(p.calmar);
    setOod(p.ood);
    setTurnover(p.turnover);
    setBreach(p.breach);
  };

  const top3 = frame.leaderboard.slice(0, 3);

  return (
    <div className="stack" style={{ ["--gap" as string]: "24px" }}>
      <div className={styles.splitWide}>
        <div className={styles.inset}>
          <div className="row-between wrap">
            <span className={styles.insetTitle}>Build a score</span>
            <ConceptPill concept="acs" label="ACS formula" align="right" />
          </div>
          <LabeledRange label={<ConceptPill concept="psr" label="PSR(0)" />} value={psr} display={psr.toFixed(2)} min={0} max={1} step={0.01} onChange={setPsr} accent="var(--bid)" />
          <LabeledRange label={<ConceptPill concept="calmar" label="Calmar, capped" />} value={calmar} display={calmar.toFixed(2)} min={0} max={1} step={0.01} onChange={setCalmar} accent="var(--evm)" />
          <LabeledRange label={<ConceptPill concept="ood" label="OOD survival" />} value={ood} display={ood.toFixed(2)} min={0} max={1} step={0.01} onChange={setOod} accent="var(--llm)" />
          <LabeledRange label="Turnover penalty" value={turnover} display={turnover.toFixed(2)} min={0} max={1} step={0.01} onChange={setTurnover} accent="var(--chaos)" />
          <label className={styles.toggle}>
            <input type="checkbox" checked={breach} onChange={(e) => setBreach(e.target.checked)} />
            Equity fell below the {MAINTENANCE_MARGIN_PCT}% maintenance margin
          </label>
        </div>

        <div className={styles.inset}>
          <span className="caption">Apex Composite Score</span>
          <span className={styles.acsTotal} data-liq={breach} aria-live="polite">
            {acs.toFixed(3)}
          </span>
          <div className={styles.acsBar} aria-hidden>
            {parts.map((p) => (
              <span
                key={p.key}
                className={styles.acsSeg}
                style={{ width: `${breach ? 0 : p.value * 100}%`, background: p.color }}
              />
            ))}
          </div>
          <table className={styles.compareTable}>
            <tbody>
              {parts.map((p) => (
                <tr key={p.key}>
                  <td>
                    <span className="row" style={{ ["--gap" as string]: "8px" }}>
                      <span className={styles.swatch} style={{ background: p.color, height: 8, width: 8, borderRadius: 2 }} />
                      {p.label}
                    </span>
                  </td>
                  <td className="r num">+{p.value.toFixed(3)}</td>
                </tr>
              ))}
              <tr>
                <td>0.10 × turnover penalty</td>
                <td className="r num">−{penalty.toFixed(3)}</td>
              </tr>
            </tbody>
          </table>
          {breach ? (
            <div className="callout callout-ask" style={{ fontSize: 13 }}>
              Liquidated. The account is force-closed and disqualified, so ACS is 0 no matter how good the other terms
              looked.
            </div>
          ) : null}
        </div>
      </div>

      <div className={styles.split}>
        <div className={styles.inset}>
          <span className={styles.insetTitle}>Why raw PnL is a trap</span>
          <table className={styles.compareTable}>
            <thead>
              <tr>
                <th>Agent</th>
                <th className="r">Calm-week PnL</th>
                <th className="r">After the crash</th>
                <th className="r">ACS</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <button type="button" className="btn btn-sm btn-ghost" onClick={() => apply(PRESETS.lucky)}>
                    Lucky leverage
                  </button>
                </td>
                <td className="r num c-bid">+38.0%</td>
                <td className="r num c-ask">liquidated</td>
                <td className="r num">0.000</td>
              </tr>
              <tr>
                <td>
                  <button type="button" className="btn btn-sm btn-ghost" onClick={() => apply(PRESETS.robust)}>
                    Robust agent
                  </button>
                </td>
                <td className="r num c-bid">+6.1%</td>
                <td className="r num c-bid">+4.8%</td>
                <td className="r num">
                  {(0.4 * PRESETS.robust.psr + 0.3 * PRESETS.robust.calmar + 0.2 * PRESETS.robust.ood - 0.1 * PRESETS.robust.turnover).toFixed(3)}
                </td>
              </tr>
            </tbody>
          </table>
          <p className={styles.insetNote}>
            Sort by PnL and the leveraged agent wins until the first flash crash wipes it out. Select either row to
            load its numbers into the calculator.
          </p>
        </div>

        <div className={styles.inset}>
          <div className="row-between">
            <span className={styles.insetTitle}>Live leaderboard, top 3</span>
            <span className="caption">sorted by ACS</span>
          </div>
          {top3.length ? (
            <ol className={styles.podium}>
              {top3.map((e, i) => {
                const kind = agentKind(e.badge);
                return (
                  <li key={e.agentId} className={styles.podiumRow}>
                    <span className={styles.rank}>{i + 1}</span>
                    <span className="row wrap" style={{ ["--gap" as string]: "8px", minWidth: 0 }}>
                      <span className="text-1" style={{ fontWeight: 600 }}>
                        {displayAgentName(e.agentId)}
                      </span>
                      <Badge tone={kind.tone}>{kind.label}</Badge>
                      {e.status === "LIQ" ? <Badge tone="ask">liquidated</Badge> : null}
                    </span>
                    <span className={`num ${e.pnlBps >= 0 ? "c-bid" : "c-ask"}`}>{fmtPct(e.pnlBps / 100)}</span>
                    <span className="num text-1" style={{ fontWeight: 600 }}>
                      {fmtAcs(e.acsScoreBps)}
                    </span>
                  </li>
                );
              })}
            </ol>
          ) : (
            <p className={styles.insetNote}>Scores appear after the first few ticks.</p>
          )}
        </div>
      </div>

      <div className={styles.finale}>
        <span className="text-2" style={{ fontSize: 15, fontWeight: 600, marginRight: 8 }}>
          That is the whole system. Where next?
        </span>
        <button type="button" className="btn btn-primary" onClick={() => onNavigate("arena")}>
          Trade in the live arena
        </button>
        <button type="button" className="btn btn-llm" onClick={() => onNavigate("lab")}>
          Build an agent
        </button>
        <button type="button" className="btn" onClick={() => onNavigate("bench")}>
          Run the chaos benchmark
        </button>
      </div>
    </div>
  );
}
