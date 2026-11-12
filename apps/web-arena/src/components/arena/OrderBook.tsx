"use client";

import { useState } from "react";
import { useArena } from "../../lib/arena";
import type { L2LevelUi } from "../../lib/sharedBuffer";
import { ConceptPill, Panel, Segmented } from "../ui";
import s from "./arena.module.css";

type DepthMode = "level" | "cumulative";

function Row({
  level,
  side,
  max,
  mode,
  onPick,
}: {
  level: L2LevelUi;
  side: "ask" | "bid";
  max: number;
  mode: DepthMode;
  onPick: () => void;
}) {
  const size = mode === "level" ? level.qtyEth : level.cumulativeEth;
  const width = Math.max(2, Math.min(100, (size / max) * 100));
  const action = side === "ask" ? "Buy" : "Sell";
  return (
    <button
      type="button"
      className={`${s.bookRow} ${side === "ask" ? s.askRow : s.bidRow}`}
      onClick={onPick}
      aria-label={`${action} at ${level.priceFormatted}, ${level.qtyFormatted} ETH resting across ${level.orderCount} orders`}
      title={`${action} at ${level.priceFormatted}`}
    >
      <span className={s.depth} style={{ width: `${width}%` }} aria-hidden />
      <span className={s.rowHint} aria-hidden />
      <span className={s.px}>{level.priceFormatted}</span>
      <span>{level.qtyEth.toFixed(2)}</span>
      <span className={s.dim}>{level.cumulativeEth.toFixed(2)}</span>
      <span className={s.dim}>{level.orderCount}</span>
    </button>
  );
}

export function OrderBook() {
  const { frame, setTicket } = useArena();
  const [mode, setMode] = useState<DepthMode>("cumulative");

  const asks = frame.asks.slice(0, 12);
  const bids = frame.bids.slice(0, 12);
  const max = Math.max(
    0.0001,
    ...[...asks, ...bids].map((l) => (mode === "level" ? l.qtyEth : l.cumulativeEth))
  );
  const asksDesc = [...asks].sort((a, b) => b.priceUsd - a.priceUsd);
  const bidsDesc = [...bids].sort((a, b) => b.priceUsd - a.priceUsd);

  const bidDepth = bids.reduce((a, l) => a + l.qtyEth, 0);
  const askDepth = asks.reduce((a, l) => a + l.qtyEth, 0);
  const bidShare = bidDepth + askDepth > 0 ? (bidDepth / (bidDepth + askDepth)) * 100 : 50;
  const imbPct = frame.imbalanceBps / 100;

  return (
    <Panel
      title="Order book"
      subtitle="L3 central limit order book, click a level to quote"
      flush
      actions={
        <Segmented
          ariaLabel="Depth bar mode"
          value={mode}
          onChange={setMode}
          options={[
            { value: "level", label: "Per level" },
            { value: "cumulative", label: "Cumulative" },
          ]}
        />
      }
      explain={{
        what: "Every resting limit order on the central limit order book, aggregated by price. Asks (sellers) sit above the spread, bids (buyers) below. Bars show size at each level or running depth from the touch.",
        how: "Click an ask to prefill a buy at that price; click a bid to prefill a sell. The order ticket below the chart picks it up. A buy at or above the best ask crosses the spread and fills immediately as a taker.",
        math: (
          <>
            Matching is strict price-time FIFO: better price first, then earliest arrival. Self-trade prevention is Cancel-Newest, so an agent&apos;s incoming order is cancelled rather than filling against its own resting quote. Prices are <code>FixedPrice(i64)</code> with <code>SCALE = 10^8</code> pips per 1.0, so $2,241.50 is stored as the integer 224,150,000,000.
          </>
        ),
      }}
    >
      <div className={s.bookHead} aria-hidden>
        <span>Price (USDT)</span>
        <span>Size (ETH)</span>
        <span>Total</span>
        <span>Orders</span>
      </div>

      <div className={s.bookSide} aria-label="Asks, highest first">
        {asksDesc.length === 0 ? (
          <div className="empty">No resting asks. Liquidity has evaporated on the sell side.</div>
        ) : (
          asksDesc.map((l) => (
            <Row key={`a-${l.pricePips}`} level={l} side="ask" max={max} mode={mode} onPick={() => setTicket(l.priceUsd, "BID")} />
          ))
        )}
      </div>

      <div className={s.spreadBanner}>
        <div className={s.spreadCell}>
          <span className="label">Mid</span>
          <span className={s.spreadValue}>{frame.clobMidFormatted}</span>
        </div>
        <div className={s.spreadCell}>
          <span className="label">Spread</span>
          <span className={s.spreadValue} style={{ color: frame.spreadBps >= 20 ? "var(--chaos)" : undefined }}>
            {frame.spreadBps} bps
          </span>
        </div>
        <div className={s.spreadCell}>
          <span className="label">Imbalance</span>
          <span className={s.spreadValue} style={{ color: imbPct >= 0 ? "var(--bid)" : "var(--ask)" }}>
            {imbPct >= 0 ? "+" : "−"}
            {Math.abs(imbPct).toFixed(1)}%
          </span>
        </div>
      </div>

      <div className={s.bookSide} aria-label="Bids, highest first">
        {bidsDesc.length === 0 ? (
          <div className="empty">No resting bids. Buyers have pulled out.</div>
        ) : (
          bidsDesc.map((l) => (
            <Row key={`b-${l.pricePips}`} level={l} side="bid" max={max} mode={mode} onPick={() => setTicket(l.priceUsd, "ASK")} />
          ))
        )}
      </div>

      <div className={s.bookFoot}>
        <div className="row-between">
          <span className="caption">
            Visible depth: <span className="num c-bid">{bidDepth.toFixed(1)}</span> bid vs{" "}
            <span className="num c-ask">{askDepth.toFixed(1)}</span> ask ETH
          </span>
          <ConceptPill concept="imbalance" label="Imbalance" align="right" />
        </div>
        <div className={s.imbalanceBar} aria-hidden>
          <span style={{ width: `${bidShare}%`, background: "var(--bid)" }} />
          <span style={{ width: `${100 - bidShare}%`, background: "var(--ask)" }} />
        </div>
        <div className="row wrap" style={{ ["--gap" as string]: "6px" }}>
          <ConceptPill concept="stp" label="Cancel-Newest STP" />
          <ConceptPill concept="fixedPoint" label="Fixed-point prices" />
        </div>
      </div>
    </Panel>
  );
}
