"use client";

import { useMemo, useState } from "react";
import { ConceptPill, Panel, Segmented } from "../ui";
import { useArena } from "../../lib/arena";
import { cn } from "../../lib/utils";
import { btn, caption, field, fieldLabel, input, label as labelCls, mono12, num as numCls } from "../ui/kit";

const SWATCH = "mr-2 inline-block size-[7px] rounded-[1px] align-middle";

const POOL_FEE = 0.003; // 30 bps, crates/apex-evm AMM_FEE_BPS
const TAKER_FEE = 0.0004; // 4 bps, crates/apex-clob DEFAULT_TAKER_FEE_BPS
const GAMMA = 1 - POOL_FEE;

type Dir = "sell" | "buy";

interface Arb {
  kind: "amm-to-clob" | "clob-to-amm" | "none";
  qty: number; // ETH moved
  quoteIn: number; // USDT spent
  quoteOut: number; // USDT received
  profit: number;
  postSpot: number;
  numericQty: number;
}

function fmt(n: number, d = 2) {
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
}
function compact(n: number) {
  const a = Math.abs(n);
  if (a >= 1e6) return (n / 1e6).toFixed(2) + "M";
  if (a >= 1e3) return (n / 1e3).toFixed(a >= 1e4 ? 0 : 1) + "k";
  return n.toFixed(0);
}
function num(v: string, fallback: number) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/** Swap `q` ETH against the pool. Mirrors crates/apex-evm execute_swap (fee taken from the input). */
function swap(x: number, y: number, q: number, dir: Dir) {
  if (dir === "sell") {
    const out = (y * GAMMA * q) / (x + GAMMA * q);
    return { x1: x + q, y1: y - out, quote: out, valid: q > 0 };
  }
  if (q >= x) return { x1: NaN, y1: NaN, quote: NaN, valid: false };
  const quoteIn = (y * q) / ((x - q) * GAMMA);
  return { x1: x - q, y1: y + quoteIn, quote: quoteIn, valid: q > 0 };
}

/**
 * Closed-form optimal arbitrage against a constant-product pool with fee γ and
 * an external venue at price P with taker fee f.
 *
 *  Pool cheap  (γ·P(1−f) > y/x): buy ETH on the pool with Δ USDT, sell on the CLOB.
 *     profit(Δ) = P(1−f) · xγΔ/(y+γΔ) − Δ  →  Δ* = (√(γ·P(1−f)·k) − y) / γ
 *     ETH bought q* = x − √(k / (γ·P(1−f)))
 *  Pool rich   (γ·y/x > P(1+f)): buy ETH on the CLOB, sell q into the pool.
 *     profit(q) = yγq/(x+γq) − P(1+f)·q  →  q* = (√(γ·k / (P(1+f))) − x) / γ
 */
function optimalArb(x: number, y: number, P: number): Arb {
  const k = x * y;
  const spot = y / x;
  const sellPx = P * (1 - TAKER_FEE);
  const buyPx = P * (1 + TAKER_FEE);
  const none: Arb = { kind: "none", qty: 0, quoteIn: 0, quoteOut: 0, profit: 0, postSpot: spot, numericQty: 0 };

  if (GAMMA * sellPx > spot) {
    const dQuote = (Math.sqrt(GAMMA * sellPx * k) - y) / GAMMA;
    const q = x - Math.sqrt(k / (GAMMA * sellPx));
    const profitOf = (qq: number) => sellPx * qq - swap(x, y, qq, "buy").quote;
    return {
      kind: "amm-to-clob",
      qty: q,
      quoteIn: dQuote,
      quoteOut: sellPx * q,
      profit: sellPx * q - dQuote,
      postSpot: (y + dQuote) / (x - q),
      numericQty: ternaryMax(profitOf, 0, x * 0.999),
    };
  }
  if (GAMMA * spot > buyPx) {
    const q = (Math.sqrt((GAMMA * k) / buyPx) - x) / GAMMA;
    const out = (y * GAMMA * q) / (x + GAMMA * q);
    const profitOf = (qq: number) => swap(x, y, qq, "sell").quote - buyPx * qq;
    return {
      kind: "clob-to-amm",
      qty: q,
      quoteIn: buyPx * q,
      quoteOut: out,
      profit: out - buyPx * q,
      postSpot: (y - out) / (x + q),
      numericQty: ternaryMax(profitOf, 0, x * 2),
    };
  }
  return none;
}

/** Independent numerical check of the closed form (profit is concave in size). */
function ternaryMax(f: (q: number) => number, lo: number, hi: number) {
  for (let i = 0; i < 200; i++) {
    const m1 = lo + (hi - lo) / 3;
    const m2 = hi - (hi - lo) / 3;
    if (f(m1) < f(m2)) lo = m1;
    else hi = m2;
  }
  return (lo + hi) / 2;
}

function Field({ label, value, onChange, step, suffix }: { label: string; value: string; onChange: (v: string) => void; step?: string; suffix?: string }) {
  return (
    <label className={field}>
      <span className={fieldLabel}>
        {label}
        {suffix ? <span className={cn(caption, "text-[12px]")}>{suffix}</span> : null}
      </span>
      <input className={input} inputMode="decimal" type="number" min="0" step={step ?? "any"} value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

export function AmmArbSimulator() {
  const { frame } = useArena();
  const [xs, setXs] = useState(() => String(Number(frame.evmReserveBaseEth.toFixed(4))));
  const [ys, setYs] = useState(() => String(Number(frame.evmReserveQuoteUsdt.toFixed(2))));
  const [ps, setPs] = useState(() => String(Number(frame.clobMidUsd.toFixed(2))));
  const [qs, setQs] = useState("10");
  const [dir, setDir] = useState<Dir>("sell");

  const x = num(xs, 1000);
  const y = num(ys, 2_200_000);
  const P = num(ps, 2200);
  const q = num(qs, 1);
  const k = x * y;
  const spot = y / x;

  const trade = swap(x, y, q, dir);
  const eff = trade.quote / q;
  const slippageBps = ((dir === "sell" ? spot - eff : eff - spot) / spot) * 10_000;
  const postSpot = trade.y1 / trade.x1;
  const impactBps = ((postSpot - spot) / spot) * 10_000;
  const basisBps = ((P - spot) / spot) * 10_000;
  const arb = useMemo(() => optimalArb(x, y, P), [x, y, P]);
  const arbX = arb.kind === "amm-to-clob" ? x - arb.qty : arb.kind === "clob-to-amm" ? x + arb.qty : x;

  const loadLive = () => {
    setXs(String(Number(frame.evmReserveBaseEth.toFixed(4))));
    setYs(String(Number(frame.evmReserveQuoteUsdt.toFixed(2))));
    setPs(String(Number(frame.clobMidUsd.toFixed(2))));
  };
  const useOptimal = () => {
    if (arb.kind === "none") return;
    setDir(arb.kind === "amm-to-clob" ? "buy" : "sell");
    setQs(arb.qty.toFixed(4));
  };

  // ---- Chart geometry ----
  const W = 640;
  const H = 360;
  const M = { l: 64, r: 20, t: 18, b: 42 };
  const xsPts = [x, trade.valid ? trade.x1 : x, arbX].filter(Number.isFinite);
  const xMin = Math.max(x * 0.05, Math.min(...xsPts) * 0.8);
  const xMax = Math.max(...xsPts) * 1.2;
  const yMin = k / xMax;
  const yMax = k / xMin;
  const sx = (v: number) => M.l + ((v - xMin) / (xMax - xMin)) * (W - M.l - M.r);
  const sy = (v: number) => H - M.b - ((v - yMin) / (yMax - yMin)) * (H - M.t - M.b);
  const curve = Array.from({ length: 120 }, (_, i) => {
    const xv = xMin + ((xMax - xMin) * i) / 119;
    return `${i === 0 ? "M" : "L"}${sx(xv).toFixed(1)} ${sy(k / xv).toFixed(1)}`;
  }).join(" ");
  const xTicks = [0, 1, 2, 3, 4].map((i) => xMin + ((xMax - xMin) * i) / 4);
  const yTicks = [0, 1, 2, 3, 4].map((i) => yMin + ((yMax - yMin) * i) / 4);
  const inChart = (vx: number, vy: number) => Number.isFinite(vx) && Number.isFinite(vy) && vx >= xMin && vx <= xMax && vy >= yMin && vy <= yMax * 1.02;
  // Tangent with slope −P at the arbitrage point: where pool price equals the CLOB.
  const tx = arbX;
  const tyv = k / tx;
  const dx = (xMax - xMin) * 0.12;

  const tradeColor = dir === "sell" ? "var(--ask)" : "var(--bid)";
  const ARB = "var(--shock)";

  return (
    <Panel
      title="AMM and arbitrage calculator"
      subtitle="The revm pool prices along x·y = k. Size a trade, see its slippage, and find the arbitrage that closes the cross-venue basis."
      explain={{
        what: "The on-chain pool and the order book quote the same asset. When their prices diverge by more than the combined fees, buying on the cheap venue and selling on the rich one is profitable — and that trade pushes the pool back toward the CLOB.",
        how: "Load the live market, or type any reserves and CLOB price. Switch between selling ETH into the pool and buying ETH from it. Use the optimal size to set the trade to the profit-maximising arbitrage.",
        math: "With γ = 0.997 and CLOB taker fee f = 4 bps, when the pool is cheap the optimal USDT input is Δ* = (√(γ·P(1−f)·k) − y)/γ, buying q* = x − √(k/(γ·P(1−f))) ETH. When the pool is rich, q* = (√(γ·k/(P(1+f))) − x)/γ. A 200-step ternary search independently checks the closed form.",
      }}
      actions={
        <button type="button" className={btn("ghost", "sm")} onClick={loadLive}>
          Load live market
        </button>
      }
    >
      <div className="grid min-w-0 grid-cols-1 gap-8 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <div className="flex min-w-0 flex-col gap-3.5">
          <div className="grid grid-cols-2 gap-3">
            <Field label="ETH reserve x" value={xs} onChange={setXs} />
            <Field label="USDT reserve y" value={ys} onChange={setYs} />
          </div>
          <Field label="CLOB mid price" suffix="USD per ETH" value={ps} onChange={setPs} step="0.01" />
          <div className={field}>
            <span className={fieldLabel}>Trade direction</span>
            <Segmented<Dir>
              ariaLabel="Trade direction"
              value={dir}
              onChange={setDir}
              options={[
                { value: "sell", label: "Sell ETH to pool" },
                { value: "buy", label: "Buy ETH from pool" },
              ]}
            />
          </div>
          <Field label="Trade size" suffix="ETH" value={qs} onChange={setQs} step="0.1" />
          <div className="flex flex-wrap gap-1.5">
            {[1, 10, 50, 100].map((v) => (
              <button key={v} type="button" className={btn("ghost", "sm", numCls)} onClick={() => setQs(String(v))}>
                {v} ETH
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            <ConceptPill concept="invariantK" /> <ConceptPill concept="basis" />
          </div>
        </div>

        <div className="flex min-w-0 flex-col gap-3.5">
          <svg className="block h-auto w-full rounded-[2px] border border-rule bg-ink" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Constant product curve. Current point ${fmt(x)} ETH and ${fmt(y, 0)} USDT. Post-trade point ${fmt(trade.x1)} ETH.`}>
            {xTicks.map((t, i) => (
              <g key={`x${i}`}>
                <line className="stroke-[rgba(237,234,227,0.06)]" x1={sx(t)} x2={sx(t)} y1={M.t} y2={H - M.b} />
                <text className="fill-bone-3 font-mono text-[13px]" x={sx(t)} y={H - M.b + 18} textAnchor="middle">
                  {compact(t)}
                </text>
              </g>
            ))}
            {yTicks.map((t, i) => (
              <g key={`y${i}`}>
                <line className="stroke-[rgba(237,234,227,0.06)]" x1={M.l} x2={W - M.r} y1={sy(t)} y2={sy(t)} />
                <text className="fill-bone-3 font-mono text-[13px]" x={M.l - 8} y={sy(t) + 4} textAnchor="end">
                  {compact(t)}
                </text>
              </g>
            ))}
            <line className="stroke-rule-2" x1={M.l} x2={W - M.r} y1={H - M.b} y2={H - M.b} />
            <line className="stroke-rule-2" x1={M.l} x2={M.l} y1={M.t} y2={H - M.b} />
            <text className="fill-bone-3 font-mono text-[13px]" x={W - M.r} y={H - 6} textAnchor="end">
              ETH reserve x
            </text>
            <text className="fill-bone-3 font-mono text-[13px]" x={M.l + 6} y={M.t + 12}>
              USDT reserve y
            </text>
            <path className="fill-none stroke-pool" strokeWidth={2} d={curve} />
            {arb.kind !== "none" && inChart(tx, tyv) ? (
              <g>
                <line
                  x1={sx(tx - dx)}
                  y1={sy(tyv + P * dx)}
                  x2={sx(tx + dx)}
                  y2={sy(tyv - P * dx)}
                  stroke={ARB}
                  strokeDasharray="4 4"
                  strokeWidth={1.5}
                />
                <circle cx={sx(tx)} cy={sy(tyv)} r={6} fill={ARB} />
              </g>
            ) : null}
            {trade.valid && inChart(trade.x1, trade.y1) ? (
              <g>
                <line x1={sx(x)} y1={sy(y)} x2={sx(trade.x1)} y2={sy(trade.y1)} stroke={tradeColor} strokeWidth={1.5} strokeDasharray="2 3" />
                <circle cx={sx(trade.x1)} cy={sy(trade.y1)} r={6} fill={tradeColor} />
              </g>
            ) : null}
            <circle cx={sx(x)} cy={sy(y)} r={7} fill="var(--pool)" stroke="var(--ink)" strokeWidth={2} />
          </svg>
          <div className="flex flex-col gap-1 font-sans text-[12.5px] text-bone-2 sm:flex-row sm:flex-wrap sm:gap-x-5">
            <span>
              <span className={SWATCH} style={{ background: "var(--pool)" }} />
              Current reserves
            </span>
            <span>
              <span className={SWATCH} style={{ background: tradeColor }} />
              After your trade (fee stays in the pool, so k grows slightly)
            </span>
            {arb.kind !== "none" ? (
              <span>
                <span className={SWATCH} style={{ background: ARB }} />
                Optimal arbitrage point (pool slope = CLOB price)
              </span>
            ) : null}
          </div>

          <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
            <Stat label="Pool spot y/x" value={`$${fmt(spot)}`} />
            <Stat label={dir === "sell" ? "You receive" : "You pay"} value={trade.valid ? `${fmt(trade.quote)} USDT` : "Exceeds reserve"} />
            <Stat label="Effective price" value={trade.valid ? `$${fmt(eff)}` : "—"} />
            <Stat label="Slippage incl. fee" value={trade.valid ? `${fmt(slippageBps, 1)} bps` : "—"} tone={slippageBps > 50 ? "var(--ask)" : undefined} />
            <Stat label="Price impact" value={trade.valid ? `${impactBps > 0 ? "+" : ""}${fmt(impactBps, 1)} bps` : "—"} />
            <Stat label="Basis vs. CLOB" value={`${basisBps > 0 ? "+" : ""}${fmt(basisBps, 1)} bps`} tone={Math.abs(basisBps) > 34 ? "var(--shock)" : undefined} />
          </div>

          <div className="border-t border-rule-2 pt-3 font-sans text-[13.5px] leading-[1.5] text-bone-2">
            {arb.kind === "none" ? (
              <p>
                No profitable arbitrage. The basis of <span className={cn(numCls, "text-bone")}>{fmt(basisBps, 1)} bps</span> sits inside the fee band — a round trip costs 30 bps on the pool plus 4 bps on the CLOB, so any trade would lose money.
              </p>
            ) : (
              <div className="flex flex-col gap-2.5">
                <p>
                  {arb.kind === "amm-to-clob" ? (
                    <>
                      The pool is cheap. Buy <span className={cn(numCls, "text-bone")}>{fmt(arb.qty, 4)} ETH</span> on revm for{" "}
                      <span className={cn(numCls, "text-bone")}>{fmt(arb.quoteIn)} USDT</span>, sell it into CLOB bids for{" "}
                      <span className={cn(numCls, "text-bone")}>{fmt(arb.quoteOut)} USDT</span> after the 4 bps taker fee.
                    </>
                  ) : (
                    <>
                      The pool is rich. Buy <span className={cn(numCls, "text-bone")}>{fmt(arb.qty, 4)} ETH</span> on the CLOB for{" "}
                      <span className={cn(numCls, "text-bone")}>{fmt(arb.quoteIn)} USDT</span> including the taker fee, sell it into the pool for{" "}
                      <span className={cn(numCls, "text-bone")}>{fmt(arb.quoteOut)} USDT</span>.
                    </>
                  )}{" "}
                  Pool spot moves to <span className={cn(numCls, "text-bone")}>${fmt(arb.postSpot)}</span>.
                </p>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className={caption}>
                    Profit{" "}
                    <span className={cn(numCls, "text-[18px] font-medium text-bid")}>{fmt(arb.profit)} USDT</span>
                    <span className="ml-3">
                      Numerical check: <span className={numCls}>{fmt(arb.numericQty, 4)} ETH</span>
                      {Math.abs(arb.numericQty - arb.qty) < Math.max(1e-3, arb.qty * 1e-4) ? " — agrees" : " — differs"}
                    </span>
                  </span>
                  <button type="button" className={btn("ghost", "sm")} onClick={useOptimal}>
                    Set trade to optimal size
                  </button>
                </div>
                <span className={caption}>Ignores CLOB depth: assumes the book absorbs the size at the quoted mid.</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </Panel>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className={cn(labelCls, "text-[12px]")}>{label}</span>
      <span className={cn(mono12, "text-[13px] text-bone")} style={tone ? { color: tone } : undefined}>
        {value}
      </span>
    </div>
  );
}
