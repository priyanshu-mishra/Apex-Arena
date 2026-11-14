"use client";

import { useEffect, useState, type FormEvent } from "react";
import { SCENARIOS, fmtUsd, useArena, type OrderSide, type OrderType } from "../../lib/arena";
import type { UserExecutionReceiptUi } from "../../lib/sharedBuffer";
import { useDensity } from "../../lib/density";
import { cn } from "../../lib/utils";
import { Badge, ConceptPill, Kbd, Panel, Segmented, Tabs } from "../ui";
import { btn, caption, dot, empty, field, fieldLabel, input, num, table, tableScroll, td, tdNum, th, toneColor } from "../ui/kit";

/* Shared layout pieces for the dock's forms. */
const FORM_GRID = "grid min-w-0 gap-6 py-4 lg:grid-cols-2";
const FORM_COL = "flex min-w-0 flex-col gap-4";
const HELP = "font-sans text-[13px] leading-[1.5] text-bone-3 text-pretty";
const CHIPS = "flex flex-wrap gap-1.5";
const SUMMARY = "flex flex-col border-t border-rule-2";
const SUMMARY_ROW = "flex items-baseline justify-between gap-3 border-b border-rule py-2 font-sans text-[13px] text-bone-2";
const SUMMARY_TOTAL = "text-bone [&>span:last-child]:text-[15px]";

type DockTab = "ticket" | "swap" | "lab" | "receipts";

const TYPE_HELP: Record<OrderType, string> = {
  LIMIT: "Rests on the book at your price until filled. If it crosses the spread, the crossing part fills immediately as a taker.",
  MARKET: "Sweeps the opposite side of the book now at the best available prices. You pay the spread plus the 4 bps taker fee.",
  POST_ONLY: "Joins the book as a maker only. Rejected if it would trade immediately, so you never pay the taker fee.",
  IOC: "Fills whatever crosses right now and cancels the rest. Never rests on the book.",
};

const TAKER_FEE_BPS = 4;
const POOL_FEE = 0.003;

/* ---------------- Order ticket ---------------- */
function OrderTicket({ flashKey }: { flashKey: number }) {
  const { frame, ticket, actions } = useArena();
  const [side, setSide] = useState<OrderSide>("BID");
  const [type, setType] = useState<OrderType>("LIMIT");
  const [price, setPrice] = useState(() => frame.clobMidUsd.toFixed(2));
  const [qty, setQty] = useState("5");
  // A book click briefly outlines the price field so the prefill is visible.
  const [flash, setFlash] = useState(false);
  useEffect(() => {
    if (!flashKey) return;
    setFlash(true);
    const id = window.setTimeout(() => setFlash(false), 700);
    return () => window.clearTimeout(id);
  }, [flashKey]);

  useEffect(() => {
    if (!ticket) return;
    setSide(ticket.side);
    setPrice(ticket.priceUsd.toFixed(2));
    setType((t) => (t === "MARKET" ? "LIMIT" : t));
  }, [ticket]);

  const bestBid = frame.bids[0]?.priceUsd ?? frame.clobMidUsd;
  const bestAsk = frame.asks[0]?.priceUsd ?? frame.clobMidUsd;
  const isMarket = type === "MARKET";
  const px = isMarket ? (side === "BID" ? bestAsk : bestBid) : Number(price);
  const q = Number(qty);
  const valid = Number.isFinite(px) && px > 0 && Number.isFinite(q) && q > 0;
  const crosses = isMarket || type === "IOC" || (side === "BID" ? px >= bestAsk : px <= bestBid);
  const takerPart = type === "POST_ONLY" ? 0 : crosses ? 1 : 0;
  const notional = valid ? px * q : 0;
  const fee = (notional * TAKER_FEE_BPS * takerPart) / 10000;
  const verb = side === "BID" ? "Buy" : "Sell";

  const outcome =
    type === "POST_ONLY" && crosses
      ? "This price crosses the spread, so the engine will reject it."
      : crosses
      ? `Crosses the spread: fills now as a taker against the best ${side === "BID" ? "ask" : "bid"}.`
      : "Below the touch: rests on the book as a maker and waits in the FIFO queue.";

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    actions.submitOrder(side, type, Number(px.toFixed(2)), q);
  };

  return (
    <form className={FORM_GRID} onSubmit={submit} aria-label="Order ticket">
      <div className={FORM_COL}>
        <div className={field}>
          <span className={fieldLabel}>Side</span>
          <Segmented
            ariaLabel="Order side"
            value={side}
            onChange={setSide}
            options={[
              { value: "BID", label: "Buy" },
              { value: "ASK", label: "Sell" },
            ]}
          />
        </div>
        <div className={field}>
          <span className={fieldLabel}>
            Order type
            <span className="flex gap-3">
              <ConceptPill concept="ioc" label="IOC" align="right" />
              <ConceptPill concept="postOnly" label="Post-only" align="right" />
            </span>
          </span>
          <Segmented
            ariaLabel="Order type"
            value={type}
            onChange={setType}
            options={[
              { value: "LIMIT", label: "Limit" },
              { value: "MARKET", label: "Market" },
              { value: "POST_ONLY", label: "Post-only" },
              { value: "IOC", label: "IOC" },
            ]}
          />
          <p className={HELP}>{TYPE_HELP[type]}</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className={field}>
            <span className={fieldLabel}>Price (USDT)</span>
            <input
              className={cn(input, flash && "border-bone bg-haze")}
              inputMode="decimal"
              value={isMarket ? "Best available" : price}
              disabled={isMarket}
              onChange={(e) => setPrice(e.target.value)}
              aria-label="Limit price in USDT"
            />
          </label>
          <label className={field}>
            <span className={fieldLabel}>Size (ETH)</span>
            <input className={input} inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} aria-label="Order size in ETH" />
          </label>
        </div>
        <div className={CHIPS} role="group" aria-label="Quick sizes">
          {[0.5, 1, 5, 10, 25].map((v) => (
            <button key={v} type="button" className={btn("ghost", "sm", num)} aria-pressed={Number(qty) === v} onClick={() => setQty(String(v))}>
              {v} ETH
            </button>
          ))}
          <button type="button" className={btn("ghost", "sm")} onClick={() => setPrice(frame.clobMidUsd.toFixed(2))} disabled={isMarket}>
            Use mid
          </button>
        </div>
      </div>

      <div className={FORM_COL}>
        <div className={SUMMARY} aria-live="polite">
          <div className={SUMMARY_ROW}>
            <span>Best bid / best ask</span>
            <span className={num}>
              <span className="text-bid">{fmtUsd(bestBid)}</span> / <span className="text-ask">{fmtUsd(bestAsk)}</span>
            </span>
          </div>
          <div className={SUMMARY_ROW}>
            <span>{isMarket ? "Expected price" : "Your price"}</span>
            <span className={num}>{valid ? fmtUsd(px) : "—"}</span>
          </div>
          <div className={SUMMARY_ROW}>
            <span>Taker fee ({takerPart ? `${TAKER_FEE_BPS} bps` : "none"})</span>
            <span className={num}>{fmtUsd(fee)}</span>
          </div>
          <div className={cn(SUMMARY_ROW, SUMMARY_TOTAL)}>
            <span>Notional</span>
            <span className={num}>{valid ? fmtUsd(notional) : "—"}</span>
          </div>
        </div>
        <p className={HELP}>{valid ? outcome : "Enter a positive price and size."}</p>
        <button type="submit" className={btn("primary", "lg", "w-full")} disabled={!valid}>
          {verb} {valid ? q : ""} ETH {isMarket ? "at market" : valid ? `at ${fmtUsd(px)}` : ""}
        </button>
        <p className={caption}>Tip: click any level in the order book to prefill this ticket.</p>
      </div>
    </form>
  );
}

/* ---------------- AMM swap ---------------- */
function AmmSwap() {
  const { frame, actions } = useArena();
  const [sellEth, setSellEth] = useState(true);
  const [amount, setAmount] = useState("10");

  const x = frame.evmReserveBaseEth;
  const y = frame.evmReserveQuoteUsdt;
  const spot = x > 0 ? y / x : 0;
  const a = Number(amount);
  const valid = Number.isFinite(a) && a > 0 && x > 0 && y > 0;
  const inNet = valid ? a * (1 - POOL_FEE) : 0;
  const out = !valid ? 0 : sellEth ? (y * inNet) / (x + inNet) : (x * inNet) / (y + inNet);
  const effPrice = !valid || out <= 0 ? 0 : sellEth ? out / a : a / out;
  const impactBps = spot > 0 && effPrice > 0 ? (Math.abs(effPrice - spot) / spot) * 1e4 : 0;
  const newX = sellEth ? x + a : x - out;
  const newY = sellEth ? y - out : y + a;
  const newSpot = newX > 0 ? newY / newX : 0;
  const feePaid = valid ? a * POOL_FEE : 0;
  const inUnit = sellEth ? "ETH" : "USDT";
  const outUnit = sellEth ? "USDT" : "ETH";
  const chips = sellEth ? [1, 10, 50, 100] : [2500, 25000, 100000, 250000];

  return (
    <form
      className={FORM_GRID}
      aria-label="AMM swap"
      onSubmit={(e) => {
        e.preventDefault();
        if (valid) actions.swap(sellEth, a);
      }}
    >
      <div className={FORM_COL}>
        <div className={field}>
          <span className={fieldLabel}>
            Direction
            <ConceptPill concept="invariantK" label="x · y = k" align="right" />
          </span>
          <Segmented
            ariaLabel="Swap direction"
            value={sellEth ? "sell" : "buy"}
            onChange={(v) => {
              setSellEth(v === "sell");
              setAmount(v === "sell" ? "10" : "25000");
            }}
            options={[
              { value: "sell", label: "Sell ETH for USDT" },
              { value: "buy", label: "Buy ETH with USDT" },
            ]}
          />
        </div>
        <label className={field}>
          <span className={fieldLabel}>You pay ({inUnit})</span>
          <input className={input} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} aria-label={`Amount in ${inUnit}`} />
        </label>
        <div className={CHIPS} role="group" aria-label="Quick amounts">
          {chips.map((v) => (
            <button key={v} type="button" className={btn("ghost", "sm", num)} aria-pressed={a === v} onClick={() => setAmount(String(v))}>
              {v.toLocaleString("en-US")} {inUnit}
            </button>
          ))}
        </div>
        <p className={HELP}>
          The swap executes inside the embedded revm EVM against the constant-product pool. Bigger trades move further along the curve and pay more slippage.
        </p>
      </div>
      <div className={FORM_COL}>
        <div className={SUMMARY} aria-live="polite">
          <div className={SUMMARY_ROW}>
            <span>Pool reserves</span>
            <span className={num}>
              {x.toLocaleString("en-US", { maximumFractionDigits: 2 })} ETH / {y.toLocaleString("en-US", { maximumFractionDigits: 0 })} USDT
            </span>
          </div>
          <div className={SUMMARY_ROW}>
            <span>Spot before / after</span>
            <span className={num}>
              {fmtUsd(spot)} / {valid ? fmtUsd(newSpot) : "—"}
            </span>
          </div>
          <div className={SUMMARY_ROW}>
            <span>Pool fee (30 bps)</span>
            <span className={num}>
              {feePaid.toLocaleString("en-US", { maximumFractionDigits: 4 })} {inUnit}
            </span>
          </div>
          <div className={SUMMARY_ROW}>
            <span>Effective price</span>
            <span className={num}>{effPrice ? fmtUsd(effPrice) : "—"}</span>
          </div>
          <div className={SUMMARY_ROW}>
            <span>Price impact incl. fee</span>
            <span className={num} style={{ color: impactBps > 100 ? "var(--ask)" : impactBps > 34 ? "var(--shock)" : undefined }}>
              {impactBps.toFixed(1)} bps
            </span>
          </div>
          <div className={cn(SUMMARY_ROW, SUMMARY_TOTAL)}>
            <span>You receive</span>
            <span className={num}>
              {out.toLocaleString("en-US", { maximumFractionDigits: sellEth ? 2 : 4 })} {outUnit}
            </span>
          </div>
        </div>
        {impactBps > 100 ? (
          <p className="border-l border-rule-2 pl-3 font-sans text-[13px] leading-[1.5] text-bone">This trade moves the pool more than 1%. Consider splitting it.</p>
        ) : null}
        <button type="submit" className={btn("primary", "lg", "w-full")} disabled={!valid}>
          Swap {valid ? a.toLocaleString("en-US") : ""} {inUnit} for {outUnit}
        </button>
        <p className={caption}>
          Quote uses <span className={num}>out = y·Δx·0.997 / (x + Δx·0.997)</span> on the current reserves; the block may move before it commits.
        </p>
      </div>
    </form>
  );
}

/* ---------------- Stress lab ---------------- */
function StressLab() {
  const { actions, paused, speed, frame } = useArena();
  return (
    <div className="flex min-w-0 flex-col gap-5 py-4">
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Simulation playback">
        <button type="button" className={btn("ghost", "md", "w-[92px]")} onClick={actions.togglePause}>
          {paused ? "Resume" : "Pause"}
        </button>
        <button type="button" className={btn()} onClick={() => actions.step(1)} disabled={!paused} title="Advance one 10 ms fast tick">
          Step 1 tick
        </button>
        <button type="button" className={btn()} onClick={() => actions.step(100)} disabled={!paused} title="Advance one macro epoch (100 ticks)">
          Step 1 epoch
        </button>
        <Segmented
          ariaLabel="Simulation speed"
          value={speed}
          onChange={actions.setSpeed}
          options={[1, 5, 15].map((v) => ({ value: v, label: <span className={num}>{v}×</span> }))}
        />
        <button type="button" className={btn()} onClick={actions.reset}>
          Reset to seed 42
        </button>
        <span className={cn(caption, "basis-full sm:ml-auto sm:basis-auto")}>
          Tick <span className={cn(num, "text-bone")}>{frame.tick.toLocaleString("en-US")}</span>, press <Kbd>Space</Kbd> to pause
        </span>
      </div>
      {/* Scenarios as stack rows: name / one sentence / action. */}
      <div className="border-t border-rule-2">
        {SCENARIOS.map((sc) => (
          <article
            key={sc.id}
            className="grid grid-cols-1 items-baseline gap-x-6 gap-y-2 border-b border-rule py-3.5 sm:grid-cols-[minmax(0,15em)_minmax(0,1fr)_auto]"
          >
            <h3 className="flex items-center gap-2 font-sans text-[15px] leading-[1.2] font-[560] text-bone [font-variation-settings:'wdth'_110]">
              <span className={dot} style={{ background: toneColor(sc.tone) }} aria-hidden />
              {sc.label}
            </h3>
            <p className="font-sans text-[13.5px] leading-[1.5] text-bone-2">{sc.description}</p>
            <button type="button" className={btn("ghost", "sm", "justify-self-start")} onClick={() => actions.injectScenario(sc.id)}>
              Inject scenario
            </button>
          </article>
        ))}
      </div>
    </div>
  );
}

/* ---------------- Receipts ---------------- */
function statusTone(st: string): "bid" | "ask" | "evm" | "chaos" | undefined {
  const u = st.toUpperCase();
  if (u.includes("REJECT") || u.includes("NEGATIVE")) return "ask";
  if (u.includes("CANCEL")) return "chaos";
  if (u.includes("RESTING")) return "evm";
  if (u.includes("FILLED") || u.includes("CAPTURED") || u.includes("COMMITTED")) return "bid";
  return undefined;
}
function sentence(st: string): string {
  const lower = st.toLowerCase().replace(/_/g, " ");
  return (lower.charAt(0).toUpperCase() + lower.slice(1)).replace(/\bioc\b/, "IOC").replace(/\bl3\b/, "L3");
}
function sideLabel(r: UserExecutionReceiptUi): string {
  if (r.side === "BID") return "Buy";
  if (r.side === "ASK") return "Sell";
  return r.orderType === "ATOMIC ARB" ? "Arbitrage" : "Swap";
}

function Receipts() {
  const { frame } = useArena();
  const rows = frame.userReceipts;
  if (rows.length === 0) {
    return <div className={empty}>No trades yet. Send an order from the ticket, swap on the AMM, or capture the arbitrage to see receipts here.</div>;
  }
  return (
    <div className={tableScroll}>
      <table className={cn(table, "min-w-[640px]")}>
        <thead>
          <tr>
            <th className={cn(th, "text-right")}>Tick</th>
            <th className={th}>Venue</th>
            <th className={th}>Trade</th>
            <th className={cn(th, "text-right")}>Price</th>
            <th className={th}>Size</th>
            <th className={th}>Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td className={tdNum}>{r.tick.toLocaleString("en-US")}</td>
              <td className={td}>{r.venue === "REVM" ? "Revm" : "CLOB"}</td>
              <td className={td}>
                <span className="font-semibold" style={{ color: r.side === "BID" ? "var(--bid)" : r.side === "ASK" ? "var(--ask)" : "var(--pool)" }}>
                  {sideLabel(r)}
                </span>{" "}
                <span className="text-bone-3">{r.orderType.replace("_", "-").toLowerCase()}</span>
                <div className="mt-1 font-sans text-[12.5px] leading-[1.4] text-bone-3">{r.detail}</div>
              </td>
              <td className={tdNum}>{r.priceFormatted}</td>
              <td className={cn(td, num, "whitespace-nowrap text-bone")}>{r.qtyFormatted.replace(/->/g, "→")}</td>
              <td className={td}>
                <Badge tone={statusTone(r.status)}>{sentence(r.status)}</Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ---------------- Dock ---------------- */
export function ExecutionDock() {
  const { ticket, frame } = useArena();
  const [density] = useDensity();
  const pro = density === "pro";
  const [tabChoice, setTab] = useState<DockTab>("ticket");
  const [flashKey, setFlashKey] = useState(0);
  // Simple shows the order ticket only; Pro adds the swap, stress lab and receipts.
  const tab: DockTab = pro ? tabChoice : "ticket";

  useEffect(() => {
    if (!ticket) return;
    setTab("ticket");
    setFlashKey(ticket.nonce);
  }, [ticket]);

  const count = frame.userReceipts.length;

  return (
    <Panel
      title={pro ? "Your desk" : "Order ticket"}
      subtitle={pro ? "Trade as the [YOU] desk, or break the market on purpose" : "Trade as the [YOU] desk against the agents"}
      flush
      explain={{
        what: "Your trading desk. Orders are routed into the same deterministic engine the agents trade against, so your fills move prices, your equity is scored with the same ACS, and you can be liquidated like anyone else.",
        how: pro
          ? "Order ticket sends limit, market, post-only or IOC orders to the CLOB. AMM swap trades directly against the revm pool. Stress lab injects scripted shocks and controls playback. Receipts lists every execution with its outcome."
          : "Pick a side, an order type, a price and a size, then send. Switch to Pro for AMM swaps, the stress lab and your receipts.",
        math: (
          <>
            CLOB taker fills pay 4 bps; makers pay nothing. AMM swaps pay 30 bps into the pool and price off <code>x · y = k</code>. All amounts are converted to <code>FixedQty(i64)</code> pips before they reach the engine, so a 5 ETH order is the integer 500,000,000.
          </>
        ),
      }}
    >
      {pro ? (
        <Tabs
          ariaLabel="Desk"
          value={tab}
          onChange={setTab}
          tabs={[
            { id: "ticket", label: "Order ticket" },
            { id: "swap", label: "AMM swap" },
            { id: "lab", label: "Stress lab" },
            { id: "receipts", label: count ? `Your receipts (${count})` : "Your receipts" },
          ]}
        />
      ) : null}
      <div role={pro ? "tabpanel" : undefined}>
        {tab === "ticket" ? <OrderTicket flashKey={flashKey} /> : null}
        {tab === "swap" ? <AmmSwap /> : null}
        {tab === "lab" ? <StressLab /> : null}
        {tab === "receipts" ? <Receipts /> : null}
      </div>
    </Panel>
  );
}
