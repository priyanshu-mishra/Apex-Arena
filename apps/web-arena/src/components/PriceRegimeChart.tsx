"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ColorType,
  CrosshairMode,
  LineSeries,
  createChart,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from "lightweight-charts";
import type { MarketRegimeLabel, PricePointUi } from "../lib/sharedBuffer";

interface PriceRegimeChartProps {
  history: PricePointUi[];
  regime: MarketRegimeLabel;
  hawkesIntensityPips: number;
  basisBps: number;
}

export function PriceRegimeChart({
  history,
  regime,
  hawkesIntensityPips,
  basisBps,
}: PriceRegimeChartProps) {
  const [chartMode, setChartMode] = useState<"PRICE" | "EQUITY">("PRICE");
  const containerRef = useRef<HTMLDivElement | null>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const primarySeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const secondarySeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const tertiarySeriesRef = useRef<ISeriesApi<"Line"> | null>(null);

  // Strictly deduplicate & sort history by ascending timeSec so lightweight-charts never throws
  const orderedHistory = useMemo(() => {
    const byTime = new Map<number, PricePointUi>();
    for (const pt of history) {
      if (pt && Number.isFinite(pt.timeSec)) {
        byTime.set(pt.timeSec, pt);
      }
    }
    return Array.from(byTime.values()).sort((a, b) => a.timeSec - b.timeSec);
  }, [history]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const chart = createChart(container, {
      width: container.clientWidth || 600,
      height: container.clientHeight || 260,
      layout: {
        background: { type: ColorType.Solid, color: "#0B0C10" },
        textColor: "#9CA3AF",
        fontFamily:
          '"JetBrains Mono", "Berkeley Mono", Menlo, Monaco, Consolas, monospace',
        fontSize: 11,
      },
      grid: {
        vertLines: { color: "#1C202B" },
        horzLines: { color: "#1C202B" },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
      },
      rightPriceScale: {
        borderColor: "#1C202B",
      },
      timeScale: {
        borderColor: "#1C202B",
        timeVisible: true,
        secondsVisible: true,
      },
    });

    const s1 = chart.addSeries(LineSeries, {
      color: "#00F59B",
      lineWidth: 2,
      title: "CLOB Mid",
    });

    const s2 = chart.addSeries(LineSeries, {
      color: "#38BDF8",
      lineWidth: 2,
      title: "Revm Pool",
    });

    const s3 = chart.addSeries(LineSeries, {
      color: "#A855F7",
      lineWidth: 2,
      visible: false,
      title: "Gemini-2.5",
    });

    chartRef.current = chart;
    primarySeriesRef.current = s1;
    secondarySeriesRef.current = s2;
    tertiarySeriesRef.current = s3;

    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          chart.applyOptions({ width, height });
          if (overlayCanvasRef.current) {
            overlayCanvasRef.current.width = width;
            overlayCanvasRef.current.height = height;
          }
        }
      }
    });
    ro.observe(container);

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
      primarySeriesRef.current = null;
      secondarySeriesRef.current = null;
      tertiarySeriesRef.current = null;
    };
  }, []);

  useEffect(() => {
    const chart = chartRef.current;
    const s1 = primarySeriesRef.current;
    const s2 = secondarySeriesRef.current;
    const s3 = tertiarySeriesRef.current;
    if (!chart || !s1 || !s2 || !s3 || orderedHistory.length === 0) return;

    try {
      if (chartMode === "PRICE") {
        s1.applyOptions({ color: "#00F59B", title: "CLOB Mid" });
        s2.applyOptions({ color: "#38BDF8", title: "Revm Pool" });
        s3.applyOptions({ visible: false });

        s1.setData(
          orderedHistory.map((pt) => ({
            time: pt.timeSec as UTCTimestamp,
            value: pt.clobMidUsd,
          }))
        );
        s2.setData(
          orderedHistory.map((pt) => ({
            time: pt.timeSec as UTCTimestamp,
            value: pt.evmSpotUsd,
          }))
        );
      } else {
        s1.applyOptions({ color: "#00F59B", title: "You (Desk)" });
        s2.applyOptions({ color: "#FF2E54", title: "MM-Alpha" });
        s3.applyOptions({ visible: true, color: "#A855F7", title: "Gemini-2.5" });

        s1.setData(
          orderedHistory.map((pt) => ({
            time: pt.timeSec as UTCTimestamp,
            value: pt.userEquityUsd,
          }))
        );
        s2.setData(
          orderedHistory.map((pt) => ({
            time: pt.timeSec as UTCTimestamp,
            value: pt.mmAlphaEquityUsd,
          }))
        );
        s3.setData(
          orderedHistory.map((pt) => ({
            time: pt.timeSec as UTCTimestamp,
            value: pt.geminiEquityUsd,
          }))
        );
      }
    } catch {
      // Guard against transient chart resize races
    }

    // Draw custom Canvas overlay for Chaos Regimes
    const canvas = overlayCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const timeScale = chart.timeScale();
    for (let i = 0; i < orderedHistory.length; i++) {
      const pt = orderedHistory[i];
      if (pt.regime === "FLASH CRASH" || pt.regime === "LIQUIDITY DROUGHT") {
        const x = timeScale.timeToCoordinate(pt.timeSec as UTCTimestamp);
        if (x !== null) {
          ctx.fillStyle =
            pt.regime === "FLASH CRASH"
              ? "rgba(245, 158, 11, 0.14)"
              : "rgba(245, 158, 11, 0.07)";
          ctx.fillRect(x - 4, 0, 8, Math.max(0, canvas.height - 26));
        }
      }
    }

    if (regime === "FLASH CRASH" || regime === "LIQUIDITY DROUGHT") {
      ctx.strokeStyle = "#F59E0B";
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      const yMid = Math.floor(Math.max(40, canvas.height - 26) * 0.52);
      ctx.beginPath();
      ctx.moveTo(0, yMid);
      ctx.lineTo(Math.max(0, canvas.width - 65), yMid);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = "rgba(11, 12, 16, 0.92)";
      ctx.fillRect(12, yMid - 18, 290, 18);
      ctx.strokeStyle = "#F59E0B";
      ctx.strokeRect(12, yMid - 18, 290, 18);
      ctx.fillStyle = "#F59E0B";
      ctx.font = '600 10px "JetBrains Mono", monospace';
      ctx.fillText(`[CHAOS EVENT: ${regime} / SPREAD EXPANSION]`, 18, yMid - 5);
    }
  }, [orderedHistory, regime, chartMode]);

  const hawkesFloat = (hawkesIntensityPips / 100_000_000).toFixed(2);
  const isOod = regime === "FLASH CRASH" || regime === "LIQUIDITY DROUGHT";

  return (
    <div className="quadrant-pane" tabIndex={0}>
      <div className="quadrant-header">
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span
            style={{ color: isOod ? "var(--color-chaos)" : "var(--text-primary)" }}
          >
            QUADRANT 3: {chartMode === "PRICE" ? "PRICE & BASIS" : "AGENT EQUITY ($)"}
          </span>
          <button
            type="button"
            className={`cyber-btn ${chartMode === "PRICE" ? "cyber-btn-active" : ""}`}
            style={{ padding: "1px 6px", fontSize: "9.5px" }}
            onClick={() => setChartMode("PRICE")}
          >
            CLOB vs REVM
          </button>
          <button
            type="button"
            className={`cyber-btn ${chartMode === "EQUITY" ? "cyber-btn-active" : ""}`}
            style={{ padding: "1px 6px", fontSize: "9.5px" }}
            onClick={() => setChartMode("EQUITY")}
          >
            EQUITY CURVES
          </button>
        </div>

        <div
          className="tabular-nums"
          style={{
            display: "flex",
            gap: "10px",
            fontFamily: "var(--font-mono)",
            fontSize: "10px",
          }}
        >
          <span style={{ color: "var(--text-secondary)" }}>
            BASIS:{" "}
            <strong
              style={{
                color: Math.abs(basisBps) >= 15 ? "var(--color-chaos)" : "var(--color-evm)",
              }}
            >
              {basisBps >= 0 ? `+${basisBps}` : basisBps}bps
            </strong>
          </span>
          <span style={{ color: "var(--color-chaos)" }}>
            ■ Hawkes λ={hawkesFloat}
          </span>
        </div>
      </div>

      <div className="quadrant-body" style={{ position: "relative" }}>
        <div ref={containerRef} style={{ width: "100%", height: "100%" }} />
        <canvas
          ref={overlayCanvasRef}
          width={600}
          height={260}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            pointerEvents: "none",
            zIndex: 2,
          }}
        />
      </div>
    </div>
  );
}
