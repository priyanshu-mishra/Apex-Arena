"use client";

import { useState } from "react";
import {
  INITIAL_EQUITY_USD,
  MAINTENANCE_MARGIN_PCT,
  USER_AGENT_ID,
  fmtSigned,
  fmtUsd,
  useArena,
} from "../../lib/arena";
import type { MarketRegimeLabel } from "../../lib/sharedBuffer";
import { Badge, KpiCard, Segmented, useDelta } from "../ui";
import { regimeLabel } from "./agentColors";
import s from "./arena.module.css";

const REGIMES: MarketRegimeLabel[] = ["CALM", "TRENDING", "LIQUIDITY DROUGHT", "FLASH CRASH"];
const ARB_MIN_BPS = 5;

function compact(n: number): string {
  if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(2) + "M";
  if (Math.abs(n) >= 1e3) return (n / 1e3).toFixed(1) + "K";
  return n.toFixed(2);
}

export function HeroKpis() {
  const { frame, actions } = useArena();
  const midDelta = useDelta(frame.clobMidUsd);
  const [arbSize, setArbSize] = useState(5);

  const bestBid = frame.bids[0]?.priceUsd;
  const bestAsk = frame.asks[0]?.priceUsd;

  const gap = frame.clobMidUsd - frame.evmSpotUsd;
  const absBasis = Math.abs(frame.basisBps);
  const arbOpen = absBasis > ARB_MIN_BPS;
  const direction =
    absBasis < 1
      ? "Venues agree. No gap to trade."
      : gap > 0
      ? "AMM cheaper: buy on Revm, sell on the CLOB."
      : "CLOB cheaper: buy on the CLOB, sell on Revm.";

  const lambda = frame.hawkesIntensityPips / 1e8;
  const lambdaTone = lambda > 1.5 ? "var(--ask)" : lambda > 0.6 ? "var(--chaos)" : "var(--bid)";

  const you = frame.leaderboard.find((r) => r.agentId === USER_AGENT_ID);
  const ranked = [...frame.leaderboard].sort((a, b) => b.acsScoreBps - a.acsScoreBps);
  const rank = you ? ranked.findIndex((r) => r.agentId === USER_AGENT_ID) + 1 : 0;
  const equity = you?.equityUsd ?? INITIAL_EQUITY_USD;
  const pnl = equity - INITIAL_EQUITY_USD;
  const ratio = equity / INITIAL_EQUITY_USD;
  const healthPct = Math.max(0, Math.min(100, ratio * 100));
  const healthTone = ratio < 0.25 ? "var(--ask)" : ratio < 0.6 ? "var(--chaos)" : "var(--bid)";
  const liquidated = you?.status === "LIQ";

  return (
    <div className="kpi-grid">
      <KpiCard
        label="CLOB mid price"
        accent="bid"
        concept="spread"
        value={<span className="num">{frame.clobMidFormatted}</span>}
        valueColor={midDelta > 0 ? "var(--bid)" : midDelta < 0 ? "var(--ask)" : undefined}
        sub={
          <>
            <Badge tone={frame.spreadBps >= 20 ? "chaos" : undefined}>
              <span className="num">{frame.spreadBps}</span> bps spread
            </Badge>
            <span className="num" style={{ color: midDelta > 0 ? "var(--bid)" : midDelta < 0 ? "var(--ask)" : undefined }}>
              {midDelta === 0 ? "unchanged" : `${midDelta > 0 ? "+" : "−"}$${Math.abs(midDelta).toFixed(2)} last tick`}
            </span>
          </>
        }
        footer={
          <div className={s.kpiFoot}>
            <div className={s.kpiLine}>
              <span>Best bid</span>
              <strong className="num c-bid">{bestBid !== undefined ? fmtUsd(bestBid) : "—"}</strong>
            </div>
            <div className={s.kpiLine}>
              <span>Best ask</span>
              <strong className="num c-ask">{bestAsk !== undefined ? fmtUsd(bestAsk) : "—"}</strong>
            </div>
          </div>
        }
      />

      <KpiCard
        label="Revm AMM spot"
        accent="evm"
        concept="invariantK"
        value={<span className="num">{frame.evmSpotFormatted}</span>}
        sub={<span>Spot = USDT reserve ÷ ETH reserve</span>}
        footer={
          <div className={s.kpiFoot}>
            <div className={s.kpiLine}>
              <span>ETH reserve</span>
              <strong className="num">{frame.evmReserveBaseEth.toLocaleString("en-US", { maximumFractionDigits: 2 })}</strong>
            </div>
            <div className={s.kpiLine}>
              <span>USDT reserve</span>
              <strong className="num">{compact(frame.evmReserveQuoteUsdt)}</strong>
            </div>
            <div className={s.kpiLine}>
              <span>Invariant k</span>
              <strong className="num">{frame.evmInvariantK}</strong>
            </div>
          </div>
        }
      />

      <KpiCard
        label="Cross-venue arbitrage"
        accent={arbOpen ? "chaos" : "evm"}
        concept="basis"
        value={
          <span className="num">
            {fmtSigned(frame.basisBps, 0)} <span style={{ fontSize: 15, color: "var(--text-3)" }}>bps</span>
          </span>
        }
        valueColor={arbOpen ? "var(--chaos)" : undefined}
        sub={
          <span className="num">
            {gap >= 0 ? "+" : "−"}${Math.abs(gap).toFixed(2)} gap per ETH
          </span>
        }
        footer={
          <div className={s.kpiFoot}>
            <p className={s.plain}>{direction}</p>
            <div className={s.sizeRow}>
              <Segmented
                ariaLabel="Arbitrage size"
                value={arbSize}
                onChange={setArbSize}
                options={[1, 5, 10].map((v) => ({ value: v, label: <span className="num">{v} ETH</span> }))}
              />
              <button
                type="button"
                className="btn btn-sm btn-chaos"
                disabled={!arbOpen}
                onClick={() => actions.captureArb(arbSize)}
                title={arbOpen ? `Route ${arbSize} ETH across both venues atomically` : `Basis must exceed ${ARB_MIN_BPS} bps`}
              >
                Capture arb
              </button>
            </div>
            <p className={s.note}>Round-trip fees are about 34 bps (30 pool + 4 taker). Smaller gaps lose money.</p>
          </div>
        }
      />

      <KpiCard
        label="Regime and Hawkes λ(t)"
        accent="regime"
        concept="hawkes"
        value={
          <span className="num" style={{ color: lambdaTone }}>
            λ {lambda.toFixed(3)}
          </span>
        }
        sub={<Badge tone="regime">{regimeLabel(frame.regime)}</Badge>}
        footer={
          <div className={s.kpiFoot}>
            <div>
              <div className={s.dangerTrack} role="meter" aria-label="Hawkes intensity" aria-valuemin={0} aria-valuemax={3} aria-valuenow={lambda}>
                <div className={s.dangerFill} style={{ width: `${Math.min(100, (lambda / 3) * 100)}%`, background: lambdaTone }} />
              </div>
              <div className={s.scaleRow} style={{ marginTop: 4 }}>
                <span>calm 0</span>
                <span>excited 1.5</span>
                <span>3</span>
              </div>
            </div>
            <div className={s.regimeSwitch} role="group" aria-label="Force market regime">
              {REGIMES.map((r) => (
                <button
                  key={r}
                  type="button"
                  className={s.regimeBtn}
                  aria-pressed={frame.regime === r}
                  onClick={() => actions.setRegime(r)}
                  title={`Force the ${regimeLabel(r).toLowerCase()} regime`}
                >
                  {regimeLabel(r)}
                </button>
              ))}
            </div>
          </div>
        }
      />

      <KpiCard
        label="Your desk"
        accent={liquidated ? "ask" : "bid"}
        concept="margin"
        value={<span className="num">{fmtUsd(equity, 0)}</span>}
        sub={
          <>
            <span className="num" style={{ color: pnl >= 0 ? "var(--bid)" : "var(--ask)" }}>
              {pnl >= 0 ? "+" : "−"}
              {fmtUsd(Math.abs(pnl), 0)} ({fmtSigned((pnl / INITIAL_EQUITY_USD) * 100, 2, "%")})
            </span>
            {liquidated ? <Badge tone="ask">Liquidated</Badge> : rank ? <Badge>Rank {rank} of {ranked.length}</Badge> : null}
          </>
        }
        footer={
          <div className={s.kpiFoot}>
            <div className={s.kpiLine}>
              <span>Inventory</span>
              <strong className="num">{(you?.inventoryEth ?? 0).toFixed(2)} ETH</strong>
            </div>
            <div className={s.kpiLine}>
              <span>Cash</span>
              <strong className="num">{fmtUsd(you?.cashUsd ?? INITIAL_EQUITY_USD, 0)}</strong>
            </div>
            <div>
              <div className={s.kpiLine} style={{ marginBottom: 6 }}>
                <span>Margin health</span>
                <strong className="num">{(ratio * 100).toFixed(1)}%</strong>
              </div>
              <div className={s.marginTrack} role="meter" aria-label="Equity as share of starting equity" aria-valuemin={0} aria-valuemax={100} aria-valuenow={healthPct}>
                <div className={s.marginFill} style={{ width: `${healthPct}%`, background: healthTone }} />
                <div className={s.marginLine} style={{ left: `${MAINTENANCE_MARGIN_PCT}%` }} title="5% maintenance line" />
              </div>
              <p className={s.note} style={{ marginTop: 6 }}>
                Below {MAINTENANCE_MARGIN_PCT}% of starting equity ({fmtUsd(INITIAL_EQUITY_USD * (MAINTENANCE_MARGIN_PCT / 100), 0)}) the desk is liquidated and ACS drops to 0.
              </p>
            </div>
          </div>
        }
      />
    </div>
  );
}
