"use client";

import { useState } from "react";
import { useArena } from "../../lib/arena";
import { Pro, useDensity } from "../../lib/density";
import type { L2LevelUi } from "../../lib/sharedBuffer";
import { cn } from "../../lib/utils";
import { ConceptPill, Panel, Segmented } from "../ui";
import { bigNum, caption, empty, label, num } from "../ui/kit";

type DepthMode = "level" | "cumulative";

const GRID = "grid grid-cols-[1.25fr_1fr_1fr_0.6fr] items-center gap-x-2 px-4";

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
      className={cn(
        GRID,
        num,
        "relative h-[24px] w-full text-left text-[12px] leading-none text-bone-2 transition-colors hover:bg-[rgba(237,234,227,0.04)] hover:text-bone",
      )}
      onClick={onPick}
      aria-label={`${action} at ${level.priceFormatted}, ${level.qtyFormatted} ETH resting across ${level.orderCount} orders`}
      title={`${action} at ${level.priceFormatted}`}
    >
      {/* Depth bar: mint / vermilion at 18% alpha behind the numbers (guide §5). */}
      <span
        className="pointer-events-none absolute inset-y-[2px] right-0"
        style={{
          width: `${width}%`,
          background: side === "ask" ? "color-mix(in srgb, var(--ask) 18%, transparent)" : "color-mix(in srgb, var(--bid) 18%, transparent)",
        }}
        aria-hidden
      />
      <span className={cn("relative", side === "ask" ? "text-ask" : "text-bid")}>{level.priceFormatted}</span>
      <span className="relative text-right text-bone">{level.qtyEth.toFixed(2)}</span>
      <span className="relative text-right">{level.cumulativeEth.toFixed(2)}</span>
      <span className="relative text-right">{level.orderCount}</span>
    </button>
  );
}

export function OrderBook() {
  const { frame, setTicket } = useArena();
  const [density] = useDensity();
  const [modeChoice, setMode] = useState<DepthMode>("cumulative");
  const mode: DepthMode = density === "pro" ? modeChoice : "cumulative";

  const depth = density === "pro" ? 12 : 8;
  const asks = frame.asks.slice(0, depth);
  const bids = frame.bids.slice(0, depth);
  const max = Math.max(0.0001, ...[...asks, ...bids].map((l) => (mode === "level" ? l.qtyEth : l.cumulativeEth)));
  const asksDesc = [...asks].sort((a, b) => b.priceUsd - a.priceUsd);
  const bidsDesc = [...bids].sort((a, b) => b.priceUsd - a.priceUsd);

  const bidDepth = bids.reduce((a, l) => a + l.qtyEth, 0);
  const askDepth = asks.reduce((a, l) => a + l.qtyEth, 0);
  const bidShare = bidDepth + askDepth > 0 ? (bidDepth / (bidDepth + askDepth)) * 100 : 50;
  const imbPct = frame.imbalanceBps / 100;

  return (
    <Panel
      title="Order book"
      subtitle="Click a level to fill the ticket"
      flush
      actions={
        <Pro>
          <Segmented
            ariaLabel="Depth bar mode"
            value={modeChoice}
            onChange={setMode}
            options={[
              { value: "level", label: "Per level" },
              { value: "cumulative", label: "Cumulative" },
            ]}
          />
        </Pro>
      }
      explain={{
        what: "Every resting limit order on the central limit order book, aggregated by price. Asks (sellers) sit above the spread, bids (buyers) below. Bars show running depth from the touch (Pro can switch to size per level).",
        how: "Click an ask to prefill a buy at that price; click a bid to prefill a sell. The order ticket picks it up. A buy at or above the best ask crosses the spread and fills immediately as a taker.",
        math: (
          <>
            Matching is strict price-time FIFO: better price first, then earliest arrival. Self-trade prevention is Cancel-Newest, so an agent&apos;s incoming order is cancelled rather than filling against its own resting quote. Prices are <code>FixedPrice(i64)</code> with <code>SCALE = 10^8</code> pips per 1.0, so $2,241.50 is stored as the integer 224,150,000,000.
          </>
        ),
      }}
    >
      <div className={cn(GRID, "h-[30px] border-b border-rule font-sans text-[12px] text-bone-3")} aria-hidden>
        <span>Price</span>
        <span className="text-right">Size ETH</span>
        <span className="text-right">Total</span>
        <span className="text-right">Orders</span>
      </div>

      <div className="py-1" aria-label="Asks, highest first" role="group">
        {asksDesc.length === 0 ? (
          <div className={empty}>No resting asks. Liquidity has evaporated on the sell side.</div>
        ) : (
          asksDesc.map((l) => (
            <Row key={`a-${l.pricePips}`} level={l} side="ask" max={max} mode={mode} onPick={() => setTicket(l.priceUsd, "BID")} />
          ))
        )}
      </div>

      <div className="grid grid-cols-3 gap-x-3 border-y border-rule-2 px-4 py-2.5">
        <div className="flex flex-col gap-1">
          <span className={label}>Mid</span>
          <span className={cn(bigNum, "text-[length:clamp(14px,1.1vw,16px)] tracking-[-0.02em]")}>{frame.clobMidFormatted}</span>
        </div>
        <div className="flex flex-col gap-1">
          <span className={label}>Spread</span>
          <span className={cn(bigNum, "text-[length:clamp(14px,1.1vw,16px)] tracking-[-0.02em]")} style={{ color: frame.spreadBps >= 20 ? "var(--shock)" : undefined }}>
            {frame.spreadBps} bps
          </span>
        </div>
        <div className="flex flex-col gap-1">
          <span className={label}>Imbalance</span>
          <span className={cn(bigNum, "text-[length:clamp(14px,1.1vw,16px)] tracking-[-0.02em]")} style={{ color: imbPct >= 0 ? "var(--bid)" : "var(--ask)" }}>
            {imbPct >= 0 ? "+" : "−"}
            {Math.abs(imbPct).toFixed(1)}%
          </span>
        </div>
      </div>

      <div className="py-1" aria-label="Bids, highest first" role="group">
        {bidsDesc.length === 0 ? (
          <div className={empty}>No resting bids. Buyers have pulled out.</div>
        ) : (
          bidsDesc.map((l) => (
            <Row key={`b-${l.pricePips}`} level={l} side="bid" max={max} mode={mode} onPick={() => setTicket(l.priceUsd, "ASK")} />
          ))
        )}
      </div>

      <Pro>
        <div className="flex flex-col gap-2.5 border-t border-rule px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className={caption}>
              Visible depth <span className={cn(num, "text-bid")}>{bidDepth.toFixed(1)}</span> bid vs{" "}
              <span className={cn(num, "text-ask")}>{askDepth.toFixed(1)}</span> ask ETH
            </span>
            <ConceptPill concept="imbalance" label="Imbalance" align="right" />
          </div>
          <div className="flex h-[3px] w-full gap-px" aria-hidden>
            <span style={{ width: `${bidShare}%`, background: "var(--bid)" }} />
            <span style={{ width: `${100 - bidShare}%`, background: "var(--ask)" }} />
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            <ConceptPill concept="stp" label="Cancel-Newest STP" />
            <ConceptPill concept="fixedPoint" label="Fixed-point prices" />
          </div>
        </div>
      </Pro>
    </Panel>
  );
}
