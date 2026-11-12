"use client";

import React, { useState } from "react";
import type { EvmTraceUi } from "../lib/sharedBuffer";

interface EvmTelemetryFeedProps {
  events: EvmTraceUi[];
  reserveBaseEth: number;
  reserveQuoteUsdt: number;
  evmSpotFormatted: string;
  evmInvariantK: string;
}

export function EvmTelemetryFeed({
  events,
  reserveBaseEth,
  reserveQuoteUsdt,
  evmSpotFormatted,
  evmInvariantK,
}: EvmTelemetryFeedProps) {
  const [filter, setFilter] = useState<"ALL" | "SWAPS" | "ALERTS">("ALL");

  const filteredEvents = events.filter((ev) => {
    if (filter === "SWAPS") {
      return ev.action.includes("SWAP");
    }
    if (filter === "ALERTS") {
      return (
        ev.action.includes("LIQUIDATION") ||
        ev.action.includes("ORACLE") ||
        ev.action.includes("ARB")
      );
    }
    return true;
  });

  return (
    <div className="quadrant-pane" tabIndex={0}>
      <div className="quadrant-header">
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ color: "var(--color-evm)" }}>
            QUADRANT 2: REVM &amp; CFMM TELEMETRY
          </span>
          {(["ALL", "SWAPS", "ALERTS"] as const).map((f) => (
            <button
              key={f}
              type="button"
              className={`cyber-btn ${filter === f ? "cyber-btn-active" : ""}`}
              style={{ padding: "1px 5px", fontSize: "9.5px" }}
              onClick={() => setFilter(f)}
            >
              {f}
            </button>
          ))}
        </div>
        <span
          className="tabular-nums"
          style={{
            color: "var(--text-secondary)",
            fontFamily: "var(--font-mono)",
            fontSize: "10px",
          }}
        >
          R_ETH={reserveBaseEth.toLocaleString("en-US")} · R_USDT=
          {reserveQuoteUsdt.toLocaleString("en-US")} · k={evmInvariantK} ({evmSpotFormatted})
        </span>
      </div>

      <div
        className="quadrant-body tabular-nums"
        style={{
          padding: "6px 10px",
          gap: "3px",
          overflowY: "auto",
          fontFamily: "var(--font-mono)",
          fontSize: "11px",
        }}
      >
        {filteredEvents.map((ev) => {
          const isLiquidation = ev.action.includes("LIQUIDATION");
          const isUser = ev.action.includes("USER_SWAP");
          const isWarning =
            ev.action.includes("ORACLE") || ev.action.includes("ARB_SLIPPAGE");
          const lineColor = isLiquidation
            ? "var(--color-ask)"
            : isUser
            ? "var(--color-bid)"
            : isWarning
            ? "var(--color-chaos)"
            : "var(--color-evm)";

          return (
            <div
              key={ev.id}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "3px 6px",
                backgroundColor: isLiquidation
                  ? "rgba(255, 46, 84, 0.1)"
                  : isUser
                  ? "rgba(0, 245, 155, 0.09)"
                  : isWarning
                  ? "rgba(245, 158, 11, 0.08)"
                  : "transparent",
                borderLeft: `2px solid ${lineColor}`,
              }}
            >
              <span
                style={{
                  color: lineColor,
                  fontWeight: isLiquidation || isUser ? 700 : 500,
                }}
              >
                {ev.logLine}
              </span>
              <span style={{ color: "var(--text-muted)", fontSize: "10px" }}>
                SLIP {ev.slippageBps}bps
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
