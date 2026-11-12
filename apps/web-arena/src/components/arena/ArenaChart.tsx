"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  ColorType,
  CrosshairMode,
  HistogramSeries,
  LineSeries,
  LineStyle,
  createChart,
  createSeriesMarkers,
  type IChartApi,
  type ISeriesApi,
  type ISeriesMarkersPluginApi,
  type SeriesMarker,
  type SeriesType,
  type Time,
  type UTCTimestamp,
} from "lightweight-charts";
import { USER_AGENT_ID, displayAgentName, fmtUsd, useArena } from "../../lib/arena";
import type { PricePointUi } from "../../lib/sharedBuffer";
import { ConceptPill, Panel, Segmented } from "../ui";
import { REGIME_COLOR, agentColor, pointEquities, regimeLabel } from "./agentColors";
import s from "./arena.module.css";

type Mode = "price" | "equity" | "drawdown" | "hawkes";

interface Pt {
  time: UTCTimestamp;
  value: number;
  color?: string;
}
interface Spec {
  key: string;
  kind: "line" | "hist";
  pane: number;
  color: string;
  title: string;
  width?: 1 | 2 | 3;
  format?: (v: number) => string;
  baseline?: { price: number; title: string };
  data: Pt[];
}

const pct = (v: number) => v.toFixed(2) + "%";
const usd0 = (v: number) => "$" + Math.round(v).toLocaleString("en-US");

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

function agentIds(hist: PricePointUi[]): string[] {
  const set = new Set<string>();
  for (const p of hist) for (const k of Object.keys(pointEquities(p))) set.add(k);
  // Put the user first so its line draws on top-ish and leads the legend.
  return [...set].sort((a, b) => (a === USER_AGENT_ID ? -1 : b === USER_AGENT_ID ? 1 : a.localeCompare(b)));
}

function buildSpecs(mode: Mode, hist: PricePointUi[], showBasis: boolean): Spec[] {
  const t = (p: PricePointUi) => p.timeSec as UTCTimestamp;
  if (mode === "price") {
    const specs: Spec[] = [
      { key: "clob", kind: "line", pane: 0, color: "#10b981", title: "CLOB mid", width: 2, data: hist.map((p) => ({ time: t(p), value: p.clobMidUsd })) },
      { key: "revm", kind: "line", pane: 0, color: "#38bdf8", title: "Revm spot", width: 2, data: hist.map((p) => ({ time: t(p), value: p.evmSpotUsd })) },
    ];
    if (showBasis) {
      specs.push({
        key: "basis",
        kind: "hist",
        pane: 1,
        color: "#f59e0b",
        title: "Basis bps",
        format: (v) => v.toFixed(0) + " bps",
        data: hist.map((p) => {
          const b = p.basisBps ?? (p.evmSpotUsd > 0 ? ((p.clobMidUsd - p.evmSpotUsd) / p.evmSpotUsd) * 1e4 : 0);
          return { time: t(p), value: b, color: Math.abs(b) > 34 ? "rgba(245,158,11,0.85)" : "rgba(148,163,184,0.45)" };
        }),
      });
    }
    return specs;
  }
  if (mode === "hawkes") {
    return [
      {
        key: "hawkes",
        kind: "line",
        pane: 0,
        color: "#f59e0b",
        title: "λ(t)",
        width: 2,
        format: (v) => v.toFixed(3),
        baseline: { price: 0.2, title: "μ baseline" },
        data: hist.filter((p) => typeof p.hawkesIntensity === "number").map((p) => ({ time: t(p), value: p.hawkesIntensity as number })),
      },
    ];
  }
  const ids = agentIds(hist);
  return ids.map((id) => {
    let peak = -Infinity;
    const data: Pt[] = [];
    for (const p of hist) {
      const eq = pointEquities(p)[id];
      if (typeof eq !== "number" || !Number.isFinite(eq)) continue;
      if (mode === "equity") {
        data.push({ time: t(p), value: eq });
      } else {
        peak = Math.max(peak, eq);
        data.push({ time: t(p), value: peak > 0 ? (eq / peak - 1) * 100 : 0 });
      }
    }
    return {
      key: id,
      kind: "line" as const,
      pane: 0,
      color: agentColor(id),
      title: displayAgentName(id),
      width: id === USER_AGENT_ID ? 3 : 2,
      format: mode === "equity" ? usd0 : pct,
      data,
    };
  });
}

function regimeMarkers(hist: PricePointUi[]): SeriesMarker<Time>[] {
  const out: SeriesMarker<Time>[] = [];
  for (let i = 1; i < hist.length; i++) {
    if (hist[i].regime !== hist[i - 1].regime) {
      out.push({
        time: hist[i].timeSec as UTCTimestamp,
        position: "aboveBar",
        shape: "circle",
        color: REGIME_COLOR[hist[i].regime] ?? "#94a3b8",
        text: regimeLabel(hist[i].regime),
      });
    }
  }
  return out.slice(-24);
}

const MODES: { value: Mode; label: string }[] = [
  { value: "price", label: "Price & basis" },
  { value: "equity", label: "Equity curves" },
  { value: "drawdown", label: "Drawdown %" },
  { value: "hawkes", label: "Hawkes λ(t)" },
];

const EXPLAIN: Record<Mode, { what: string; math: ReactNode }> = {
  price: {
    what: "The CLOB mid (green) against the Revm AMM spot (blue). The lower pane shows the basis between them; amber bars mark moments the gap exceeded the ~34 bps round-trip fee, which is when arbitrage pays.",
    math: (
      <>
        <code>basis_bps = (CLOB_mid − Revm_spot) / Revm_spot × 10,000</code>. Revm spot is <code>y / x</code> from the pool reserves; CLOB mid is the average of best bid and best ask.
      </>
    ),
  },
  equity: {
    what: "Marked-to-market equity of every agent, starting from $724,000 each. Your desk is the thicker green line.",
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

export function ArenaChart() {
  const { history, frame } = useArena();
  const [mode, setMode] = useState<Mode>("price");
  const [showBasis, setShowBasis] = useState(true);
  const hostRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<Map<string, ISeriesApi<SeriesType>>>(new Map());
  const markersRef = useRef<ISeriesMarkersPluginApi<Time> | null>(null);
  const layoutKey = useRef<string>("");

  const hist = useMemo(() => dedupe(history), [history]);
  const specs = useMemo(() => buildSpecs(mode, hist, showBasis), [mode, hist, showBasis]);

  // Create once, resize with the container, dispose on unmount.
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const chart = createChart(host, {
      width: host.clientWidth || 600,
      height: host.clientHeight || 420,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#94a3b8",
        fontFamily: '"JetBrains Mono", ui-monospace, Menlo, monospace',
        fontSize: 12,
        panes: { separatorColor: "#1e2638", separatorHoverColor: "#2a3449" },
      },
      grid: { vertLines: { color: "rgba(30,38,56,0.55)" }, horzLines: { color: "rgba(30,38,56,0.55)" } },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: "#1e2638" },
      timeScale: { borderColor: "#1e2638", timeVisible: true, secondsVisible: true, rightOffset: 4 },
      localization: { priceFormatter: (v: number) => v.toLocaleString("en-US", { maximumFractionDigits: 2 }) },
    });
    chartRef.current = chart;
    const ro = new ResizeObserver((entries) => {
      const r = entries[0]?.contentRect;
      if (r && r.width > 0 && r.height > 0) chart.applyOptions({ width: r.width, height: r.height });
    });
    ro.observe(host);
    const series = seriesRef.current;
    return () => {
      ro.disconnect();
      markersRef.current = null;
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
        markersRef.current?.detach();
        markersRef.current = null;
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
          sr =
            spec.kind === "hist"
              ? (chart.addSeries(HistogramSeries, { color: spec.color, title: spec.title, priceFormat, priceLineVisible: false }, spec.pane) as ISeriesApi<SeriesType>)
              : (chart.addSeries(
                  LineSeries,
                  { color: spec.color, lineWidth: spec.width ?? 2, title: spec.title, priceFormat, lastValueVisible: true, priceLineVisible: false },
                  spec.pane
                ) as ISeriesApi<SeriesType>);
          if (spec.baseline) {
            sr.createPriceLine({
              price: spec.baseline.price,
              color: "rgba(148,163,184,0.6)",
              lineStyle: LineStyle.Dashed,
              lineWidth: 1,
              axisLabelVisible: true,
              title: spec.baseline.title,
            });
          }
          map.set(spec.key, sr);
        }
        (sr as ISeriesApi<"Line">).setData(spec.data);
      }

      const panes = chart.panes();
      if (panes.length > 1) {
        panes[0].setStretchFactor(0.74);
        panes[1].setStretchFactor(0.26);
      }

      const primary = specs[0] ? map.get(specs[0].key) : undefined;
      if (primary) {
        const markers = regimeMarkers(hist);
        if (!markersRef.current) markersRef.current = createSeriesMarkers(primary, markers);
        else markersRef.current.setMarkers(markers);
      }

      if (modeChanged) {
        chart.timeScale().fitContent();
        layoutKey.current = key;
      }
    } catch {
      // A resize racing a series swap can throw once; the next frame resyncs.
    }
  }, [specs, hist, mode, showBasis]);

  const last = hist[hist.length - 1];
  const legend = useMemo(() => {
    return specs.map((sp) => {
      const v = sp.data[sp.data.length - 1]?.value;
      const fmt = sp.format ?? ((n: number) => fmtUsd(n));
      return { key: sp.key, color: sp.color, title: sp.title, value: v === undefined ? "—" : fmt(v), you: sp.key === USER_AGENT_ID };
    });
  }, [specs]);

  const ex = EXPLAIN[mode];
  const empty = specs.every((sp) => sp.data.length === 0);

  return (
    <Panel
      title="Market and performance chart"
      subtitle={last ? `Tick ${last.tick.toLocaleString("en-US")}, ${hist.length} points` : "Waiting for the first frame"}
      flush
      actions={<ConceptPill concept={mode === "hawkes" ? "hawkes" : mode === "price" ? "basis" : mode === "drawdown" ? "calmar" : "acs"} align="right" />}
      explain={{
        what: ex.what,
        how: "Switch views with the tabs above the chart. Drag to pan, scroll to zoom, hover for exact values. Dots on the first line mark the moment the market regime changed.",
        math: ex.math,
      }}
    >
      <div className={s.chartToolbar}>
        <Segmented ariaLabel="Chart mode" value={mode} onChange={setMode} options={MODES} />
        {mode === "price" ? (
          <button type="button" className="btn btn-sm btn-ghost" aria-pressed={showBasis} onClick={() => setShowBasis((v) => !v)}>
            {showBasis ? "Hide basis pane" : "Show basis pane"}
          </button>
        ) : null}
      </div>
      <div className={s.chartWrap}>
        <div ref={hostRef} className={s.chartHost} role="img" aria-label={`${MODES.find((m) => m.value === mode)?.label} chart`} />
        {empty ? <div className={s.chartEmpty}>Collecting history. The chart fills as the arena ticks.</div> : null}
      </div>
      <div className={s.legend}>
        {legend.map((l) => (
          <span key={l.key} className={s.legendItem} style={l.you ? { color: "var(--text)", fontWeight: 600 } : undefined}>
            <span className={s.swatch} style={{ background: l.color }} />
            {l.title}
            <span className="num text-1">{l.value}</span>
          </span>
        ))}
        <span className={s.legendItem} style={{ marginLeft: "auto" }}>
          <span className="caption">Regime markers</span>
          {(["CALM", "TRENDING", "LIQUIDITY DROUGHT", "FLASH CRASH"] as const).map((r) => (
            <span key={r} className={s.legendItem} style={{ fontSize: 12, color: frame.regime === r ? "var(--text)" : "var(--text-3)" }}>
              <span className={s.swatchDot} style={{ background: REGIME_COLOR[r] }} />
              {regimeLabel(r)}
            </span>
          ))}
        </span>
      </div>
    </Panel>
  );
}
