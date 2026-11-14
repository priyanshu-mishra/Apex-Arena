"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  HistogramSeries,
  LineSeries,
  LineStyle,
  createChart,
  type IChartApi,
  type ISeriesApi,
  type SeriesType,
  type UTCTimestamp,
} from "lightweight-charts";
import { USER_AGENT_ID, displayAgentName, fmtUsd, useArena } from "../../lib/arena";
import { useDensity } from "../../lib/density";
import type { PricePointUi } from "../../lib/sharedBuffer";
import { cn } from "../../lib/utils";
import { ConceptPill, Panel, Segmented } from "../ui";
import { btn, dot, mono12 } from "../ui/kit";
import { REGIME_BAND_ALPHA, agentColor, pointEquities, regimeLabel } from "./agentColors";

type Mode = "price" | "equity" | "drawdown" | "hawkes";

/* Chart colours (guide §2 / §5): bone outlines, mint / vermilion bodies, amber regime bands. */
const BONE = "#EDEAE3";
const BONE_3 = "#8C8A84";
const BID = "#45E0BC";
const ASK = "#FF5A45";
const POOL = "#6C9CFF";
const SHOCK = "#FFB020";
const GRID = "rgba(237,234,227,0.06)";
const RULE = "rgba(237,234,227,0.13)";
const shockA = (a: number) => `rgba(255,176,32,${a})`;

/** Ticks per candle: one candle per 100 ms of virtual time. */
const BUCKET = 10;
/** Keep fitting while the chart holds only this many bars (the first ~1 s of candles). */
const FIT_WHILE_UNDER = 12;

type Datum = { time: UTCTimestamp; [k: string]: unknown };
interface Spec {
  key: string;
  kind: "line" | "hist" | "candle" | "band";
  pane: number;
  color: string;
  title: string;
  width?: 1 | 2 | 3;
  format?: (v: number) => string;
  baseline?: { price: number; title: string };
  data: Datum[];
  /** Last value for the legend. */
  last?: number;
}

const pct = (v: number) => v.toFixed(2) + "%";
const usd0 = (v: number) => "$" + Math.round(v).toLocaleString("en-US");

/** Strictly ascending, de-duplicated timestamps (CLAUDE.md §3.2). */
function dedupe(history: PricePointUi[]): PricePointUi[] {
  const out: PricePointUi[] = [];
  for (const p of history) {
    if (!p || !Number.isFinite(p.timeSec)) continue;
    const last = out[out.length - 1];
    if (!last || p.timeSec > last.timeSec) out.push(p);
    else if (p.timeSec === last.timeSec) out[out.length - 1] = p;
  }
  return out;
}

const basisOf = (p: PricePointUi) =>
  p.basisBps ?? (p.evmSpotUsd > 0 ? ((p.clobMidUsd - p.evmSpotUsd) / p.evmSpotUsd) * 1e4 : 0);

interface Bucket {
  time: UTCTimestamp;
  open: number;
  high: number;
  low: number;
  close: number;
  spot: number;
  basis: number;
  band: number;
}

/** Groups ticks into candles. Bucket times derive from ascending timeSec, so they ascend too. */
function buckets(hist: PricePointUi[]): Bucket[] {
  const out: Bucket[] = [];
  for (const p of hist) {
    const time = (Math.floor(p.timeSec / BUCKET) * BUCKET) as UTCTimestamp;
    const b = out[out.length - 1];
    const band = REGIME_BAND_ALPHA[p.regime] ?? 0;
    if (b && b.time === time) {
      b.high = Math.max(b.high, p.clobMidUsd);
      b.low = Math.min(b.low, p.clobMidUsd);
      b.close = p.clobMidUsd;
      b.spot = p.evmSpotUsd;
      b.basis = basisOf(p);
      b.band = Math.max(b.band, band);
    } else {
      const open = b ? b.close : p.clobMidUsd;
      out.push({
        time,
        open,
        high: Math.max(open, p.clobMidUsd),
        low: Math.min(open, p.clobMidUsd),
        close: p.clobMidUsd,
        spot: p.evmSpotUsd,
        basis: basisOf(p),
        band,
      });
    }
  }
  return out;
}

function bandSpec(points: { time: UTCTimestamp; alpha: number }[]): Spec {
  return {
    key: "regime",
    kind: "band",
    pane: 0,
    color: shockA(0.1),
    title: "",
    data: points.map((p) => (p.alpha > 0 ? { time: p.time, value: 1, color: shockA(p.alpha) } : { time: p.time })),
  };
}

function agentIds(hist: PricePointUi[]): string[] {
  const set = new Set<string>();
  for (const p of hist) for (const k of Object.keys(pointEquities(p))) set.add(k);
  return [...set].sort((a, b) => (a === USER_AGENT_ID ? -1 : b === USER_AGENT_ID ? 1 : a.localeCompare(b)));
}

function buildSpecs(mode: Mode, hist: PricePointUi[], showBasis: boolean): Spec[] {
  const t = (p: PricePointUi) => p.timeSec as UTCTimestamp;
  if (mode === "price") {
    const bs = buckets(hist);
    const specs: Spec[] = [
      bandSpec(bs.map((b) => ({ time: b.time, alpha: b.band }))),
      {
        key: "clob",
        kind: "candle",
        pane: 0,
        color: BONE,
        title: "CLOB mid",
        data: bs.map((b) => ({ time: b.time, open: b.open, high: b.high, low: b.low, close: b.close })),
        last: bs[bs.length - 1]?.close,
      },
      {
        key: "revm",
        kind: "line",
        pane: 0,
        color: POOL,
        title: "Revm spot",
        width: 1,
        data: bs.map((b) => ({ time: b.time, value: b.spot })),
        last: bs[bs.length - 1]?.spot,
      },
    ];
    if (showBasis) {
      specs.push({
        key: "basis",
        kind: "hist",
        pane: 1,
        color: BONE_3,
        title: "Basis bps",
        format: (v) => v.toFixed(0) + " bps",
        data: bs.map((b) => ({
          time: b.time,
          value: b.basis,
          color: Math.abs(b.basis) > 34 ? shockA(0.85) : "rgba(168,166,159,0.4)",
        })),
        last: bs[bs.length - 1]?.basis,
      });
    }
    return specs;
  }
  const band = bandSpec(hist.map((p) => ({ time: t(p), alpha: REGIME_BAND_ALPHA[p.regime] ?? 0 })));
  if (mode === "hawkes") {
    const pts = hist.filter((p) => typeof p.hawkesIntensity === "number");
    return [
      band,
      {
        key: "hawkes",
        kind: "line",
        pane: 0,
        color: SHOCK,
        title: "λ(t)",
        width: 2,
        format: (v) => v.toFixed(3),
        baseline: { price: 0.2, title: "μ baseline" },
        data: pts.map((p) => ({ time: t(p), value: p.hawkesIntensity as number })),
        last: pts[pts.length - 1]?.hawkesIntensity,
      },
    ];
  }
  const ids = agentIds(hist);
  return [
    band,
    ...ids.map((id) => {
      let peak = -Infinity;
      const data: Datum[] = [];
      let last: number | undefined;
      for (const p of hist) {
        const eq = pointEquities(p)[id];
        if (typeof eq !== "number" || !Number.isFinite(eq)) continue;
        let v = eq;
        if (mode === "drawdown") {
          peak = Math.max(peak, eq);
          v = peak > 0 ? (eq / peak - 1) * 100 : 0;
        }
        data.push({ time: t(p), value: v });
        last = v;
      }
      return {
        key: id,
        kind: "line" as const,
        pane: 0,
        color: agentColor(id),
        title: displayAgentName(id),
        width: (id === USER_AGENT_ID ? 2 : 1) as 1 | 2,
        format: mode === "equity" ? usd0 : pct,
        data,
        last,
      };
    }),
  ];
}

const MODES: { value: Mode; label: string; title: string }[] = [
  { value: "price", label: "Price", title: "Price chart" },
  { value: "equity", label: "Equity", title: "Equity curves" },
  { value: "drawdown", label: "Drawdown", title: "Drawdown" },
  { value: "hawkes", label: "Hawkes λ(t)", title: "Hawkes intensity" },
];

const EXPLAIN: Record<Mode, { what: string; math: ReactNode }> = {
  price: {
    what: "The CLOB mid as candles (one per 100 ms of virtual time: mint when it closed higher, vermilion when lower) against the Revm AMM spot (blue line). Amber bands mark ticks when the market was out of its calm regime. In Pro, the lower pane shows the basis between the venues; amber bars mark moments the gap exceeded the ~34 bps round-trip fee, which is when arbitrage pays.",
    math: (
      <>
        <code>basis_bps = (CLOB_mid − Revm_spot) / Revm_spot × 10,000</code>. Revm spot is <code>y / x</code> from the pool reserves; CLOB mid is the average of best bid and best ask.
      </>
    ),
  },
  equity: {
    what: "Marked-to-market equity of every agent, starting from $724,000 each. Your desk is the thicker bone line.",
    math: (
      <>
        <code>equity = cash + inventory × CLOB_mid</code>, all in fixed-point pips on the engine side. Every agent starts with identical capital, so curves are directly comparable.
      </>
    ),
  },
  drawdown: {
    what: "How far each agent sits below its own running equity peak. Deep troughs drag the Calmar term of the ACS down, and a fall to 5% of starting equity triggers liquidation.",
    math: (
      <>
        <code>drawdown_t = equity_t / max(equity_0..t) − 1</code>, computed here in the browser from the equity history.
      </>
    ),
  },
  hawkes: {
    what: "The Hawkes intensity λ(t): the instantaneous rate of market shocks. It jumps on every event and decays back toward its baseline, so clustered spikes mean cascading stress.",
    math: (
      <>
        <code>λ(t) = μ + Σ α·e^(−β(t − tᵢ))</code> with baseline <code>μ = 0.2</code>. The Markov-switching chaos engine uses λ to decide when regimes flip.
      </>
    ),
  },
};

function monoFamily(): string {
  if (typeof window === "undefined") return "ui-monospace, monospace";
  const v = getComputedStyle(document.documentElement).getPropertyValue("--font-martian").trim();
  return v ? `${v}, ui-monospace, monospace` : "ui-monospace, monospace";
}

export function ArenaChart() {
  const { history, frame } = useArena();
  const [density] = useDensity();
  const pro = density === "pro";
  const [modeChoice, setMode] = useState<Mode>("price");
  const [basisChoice, setShowBasis] = useState(true);
  // Simple shows the price story only; Pro adds the other views and the basis pane.
  const mode: Mode = pro ? modeChoice : "price";
  const showBasis = pro && basisChoice;

  const hostRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<Map<string, ISeriesApi<SeriesType>>>(new Map());
  const layoutKey = useRef<string>("");
  /** Last data extent seen by the sync, to spot a reset (time went backwards or the history collapsed). */
  const extent = useRef<{ bars: number; last: number }>({ bars: 0, last: 0 });

  const hist = useMemo(() => dedupe(history), [history]);
  const specs = useMemo(() => buildSpecs(mode, hist, showBasis), [mode, hist, showBasis]);

  // Create once, resize with the container, dispose on unmount.
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const chart = createChart(host, {
      width: host.clientWidth || 600,
      height: host.clientHeight || 400,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: BONE_3,
        fontFamily: monoFamily(),
        fontSize: 12,
        attributionLogo: false,
        panes: { separatorColor: RULE, separatorHoverColor: "rgba(237,234,227,0.28)" },
      },
      grid: { vertLines: { color: GRID }, horzLines: { color: GRID } },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: "rgba(237,234,227,0.35)", labelBackgroundColor: "#141A24" },
        horzLine: { color: "rgba(237,234,227,0.35)", labelBackgroundColor: "#141A24" },
      },
      rightPriceScale: { borderColor: RULE },
      timeScale: { borderColor: RULE, timeVisible: true, secondsVisible: true, rightOffset: 4 },
      localization: { priceFormatter: (v: number) => v.toLocaleString("en-US", { maximumFractionDigits: 2 }) },
    });
    chartRef.current = chart;
    // Dev / test hook: lets e2e read the visible range (never shipped in production builds).
    if (process.env.NODE_ENV !== "production") (window as unknown as { __apexChart?: IChartApi }).__apexChart = chart;
    const ro = new ResizeObserver((entries) => {
      const r = entries[0]?.contentRect;
      if (r && r.width > 0 && r.height > 0) chart.applyOptions({ width: r.width, height: r.height });
    });
    ro.observe(host);
    const series = seriesRef.current;
    return () => {
      ro.disconnect();
      series.clear();
      chart.remove();
      chartRef.current = null;
      layoutKey.current = "";
    };
  }, []);

  // Sync series with the current specs.
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    const map = seriesRef.current;
    const key = `${mode}|${showBasis}`;
    const modeChanged = layoutKey.current !== key;

    try {
      if (modeChanged) {
        for (const sr of map.values()) chart.removeSeries(sr);
        map.clear();
        while (chart.panes().length > 1) chart.removePane(chart.panes().length - 1);
      }

      const wanted = new Set(specs.map((x) => x.key));
      for (const [k, sr] of map) {
        if (!wanted.has(k)) {
          chart.removeSeries(sr);
          map.delete(k);
        }
      }

      for (const spec of specs) {
        let sr = map.get(spec.key);
        if (!sr) {
          const priceFormat = spec.format
            ? { type: "custom" as const, formatter: spec.format, minMove: 0.0001 }
            : { type: "price" as const, precision: 2, minMove: 0.01 };
          if (spec.kind === "band") {
            sr = chart.addSeries(
              HistogramSeries,
              { color: spec.color, priceScaleId: "regime", priceLineVisible: false, lastValueVisible: false, base: 0 },
              spec.pane,
            ) as ISeriesApi<SeriesType>;
            chart.priceScale("regime", spec.pane).applyOptions({ visible: false, scaleMargins: { top: 0, bottom: 0 } });
          } else if (spec.kind === "candle") {
            sr = chart.addSeries(
              CandlestickSeries,
              {
                upColor: BID,
                downColor: ASK,
                borderUpColor: BONE,
                borderDownColor: BONE,
                wickUpColor: BONE,
                wickDownColor: BONE,
                title: spec.title,
                priceFormat,
                priceLineVisible: false,
              },
              spec.pane,
            ) as ISeriesApi<SeriesType>;
          } else if (spec.kind === "hist") {
            sr = chart.addSeries(
              HistogramSeries,
              { color: spec.color, title: spec.title, priceFormat, priceLineVisible: false },
              spec.pane,
            ) as ISeriesApi<SeriesType>;
          } else {
            sr = chart.addSeries(
              LineSeries,
              { color: spec.color, lineWidth: spec.width ?? 2, title: spec.title, priceFormat, lastValueVisible: true, priceLineVisible: false },
              spec.pane,
            ) as ISeriesApi<SeriesType>;
          }
          if (spec.baseline) {
            sr.createPriceLine({
              price: spec.baseline.price,
              color: "rgba(168,166,159,0.6)",
              lineStyle: LineStyle.Dashed,
              lineWidth: 1,
              axisLabelVisible: true,
              title: spec.baseline.title,
            });
          }
          map.set(spec.key, sr);
        }
        (sr as ISeriesApi<"Line">).setData(spec.data as Parameters<ISeriesApi<"Line">["setData"]>[0]);
      }

      const panes = chart.panes();
      if (panes.length > 1) {
        panes[0].setStretchFactor(0.74);
        panes[1].setStretchFactor(0.26);
      }

      // Fit on a mode change, after a reset (time went backwards, or the history collapsed; the capped
      // window sliding by a bar is not a reset) and while the first few candles arrive. Otherwise leave the user's pan / zoom alone; the chart follows new bars itself.
      const bars = Math.max(0, ...specs.map((sp) => sp.data.length));
      const last = Math.max(0, ...specs.map((sp) => Number(sp.data[sp.data.length - 1]?.time ?? 0)));
      const reset = last < extent.current.last || bars < extent.current.bars / 2;
      extent.current = { bars, last };
      if (modeChanged || reset || bars <= FIT_WHILE_UNDER) chart.timeScale().fitContent();
      if (modeChanged) layoutKey.current = key;
    } catch {
      // A resize racing a series swap can throw once; the next frame resyncs.
    }
  }, [specs, mode, showBasis]);

  const last = hist[hist.length - 1];
  const legend = useMemo(
    () =>
      specs
        .filter((sp) => sp.kind !== "band")
        .map((sp) => {
          const v = sp.last;
          const fmt = sp.format ?? ((n: number) => fmtUsd(n));
          return { key: sp.key, color: sp.color, title: sp.title, value: v === undefined ? "—" : fmt(v), you: sp.key === USER_AGENT_ID };
        }),
    [specs],
  );

  const ex = EXPLAIN[mode];
  const meta = MODES.find((m) => m.value === mode) ?? MODES[0];
  const empty = specs.every((sp) => sp.data.length === 0);
  const shock = frame.regime !== "CALM";

  return (
    <Panel
      title={meta.title}
      subtitle={last ? `Tick ${last.tick.toLocaleString("en-US")}, ${hist.length.toLocaleString("en-US")} points` : "Waiting for the first frame"}
      flush
      actions={<ConceptPill concept={mode === "hawkes" ? "hawkes" : mode === "price" ? "basis" : mode === "drawdown" ? "calmar" : "acs"} align="right" />}
      explain={{
        what: ex.what,
        how: pro
          ? "Switch views with the buttons above the chart. Drag to pan, scroll to zoom, hover for exact values."
          : "Drag to pan, scroll to zoom, hover for exact values. Switch to Pro for equity, drawdown and Hawkes views and the basis pane.",
        math: ex.math,
      }}
    >
      {pro ? (
        <div className="flex flex-wrap items-center gap-2 border-b border-rule px-4 py-2.5">
          <Segmented ariaLabel="Chart mode" value={modeChoice} onChange={setMode} options={MODES.map((m) => ({ value: m.value, label: m.label }))} />
          {mode === "price" ? (
            <button type="button" className={btn("ghost", "sm")} aria-pressed={basisChoice} onClick={() => setShowBasis((v) => !v)}>
              Basis pane
            </button>
          ) : null}
        </div>
      ) : null}
      <div className="relative h-[clamp(280px,46vh,440px)] w-full min-w-0">
        <div ref={hostRef} className="absolute inset-0" role="img" aria-label={`${meta.title}, ${legend.map((l) => `${l.title} ${l.value}`).join(", ")}`} />
        {empty ? (
          <div className="absolute inset-0 grid place-items-center font-sans text-[13.5px] text-bone-3">
            Collecting history. The chart fills as the arena ticks.
          </div>
        ) : null}
      </div>
      <div className={cn(mono12, "flex flex-wrap items-center gap-x-5 gap-y-1.5 border-t border-rule px-4 py-2.5 text-bone-2")}>
        {legend.map((l) => (
          <span key={l.key} className={cn("inline-flex items-center gap-2", l.you && "text-bone")}>
            <span className="inline-block h-[2px] w-3" style={{ background: l.color }} aria-hidden />
            <span className="font-sans text-[12.5px]">{l.title}</span>
            <span className="text-bone">{l.value}</span>
          </span>
        ))}
        <span className="inline-flex items-center gap-2 sm:ml-auto">
          <span className={dot} style={{ background: shock ? SHOCK : "transparent", outline: `1px solid ${shock ? SHOCK : BONE_3}` }} aria-hidden />
          <span className="font-sans text-[12.5px]">Amber bands: shock regimes · now {regimeLabel(frame.regime).toLowerCase()}</span>
        </span>
      </div>
    </Panel>
  );
}
