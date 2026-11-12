"use client";

import React from "react";
import type { L2LevelUi } from "../lib/sharedBuffer";

interface OrderBookLadderProps {
  bids: L2LevelUi[];
  asks: L2LevelUi[];
  spreadBps: number;
  imbalanceBps: number;
  clobMidFormatted: string;
  onSelectPrice?: (priceUsd: number, side: "BID" | "ASK") => void;
}

export function OrderBookLadder({
  bids,
  asks,
  spreadBps,
  imbalanceBps,
  clobMidFormatted,
  onSelectPrice,
}: OrderBookLadderProps) {
  const maxCumEth = Math.max(
    1,
    ...asks.map((a) => a.cumulativeEth),
    ...bids.map((b) => b.cumulativeEth)
  );

  const orderedAsks = [...asks].reverse();

  return (
    <div className="quadrant-pane" tabIndex={0}>
      <div className="quadrant-header">
        <span>QUADRANT 1: L2/L3 ORDER BOOK DEPTH (STP: CANCEL-NEWEST)</span>
        <span
          style={{
            color: "var(--color-evm)",
            fontFamily: "var(--font-mono)",
            fontSize: "10px",
          }}
        >
          CLICK ROW TO QUOTE
        </span>
      </div>

      <div
        className="quadrant-body"
        style={{
          padding: "6px 10px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          overflowY: "auto",
        }}
      >
        {/* Column Headers */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "40px 92px 72px 72px 1fr",
            color: "var(--text-secondary)",
            fontSize: "10px",
            borderBottom: "1px solid var(--border-grid)",
            paddingBottom: "3px",
          }}
        >
          <span>SIDE</span>
          <span style={{ textAlign: "right" }}>PRICE</span>
          <span style={{ textAlign: "right" }}>SIZE</span>
          <span style={{ textAlign: "right" }}>CUM ETH</span>
          <span style={{ paddingLeft: "10px" }}>L2 DEPTH</span>
        </div>

        {/* Asks Ladder */}
        <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
          {orderedAsks.map((ask, idx) => {
            const widthPct = Math.max(
              6,
              Math.min(100, Math.round((ask.cumulativeEth / maxCumEth) * 100))
            );
            return (
              <div
                key={`ask-${idx}-${ask.pricePips}`}
                onClick={() => onSelectPrice?.(ask.priceUsd, "BID")}
                title="Click to buy at this Ask price"
                className="tabular-nums"
                style={{
                  display: "grid",
                  gridTemplateColumns: "40px 92px 72px 72px 1fr",
                  alignItems: "center",
                  height: "20px",
                  cursor: "pointer",
                  padding: "0 2px",
                }}
              >
                <span style={{ color: "var(--color-ask)", fontWeight: 700 }}>
                  ASK
                </span>
                <span
                  style={{
                    textAlign: "right",
                    color: "var(--text-primary)",
                    fontWeight: 600,
                  }}
                >
                  {ask.priceFormatted}
                </span>
                <span
                  style={{ textAlign: "right", color: "var(--text-secondary)" }}
                >
                  {ask.qtyFormatted}
                </span>
                <span style={{ textAlign: "right", color: "var(--text-muted)" }}>
                  {ask.cumulativeEth.toFixed(2)}
                </span>
                <div
                  style={{
                    paddingLeft: "10px",
                    display: "flex",
                    alignItems: "center",
                  }}
                >
                  <div
                    style={{
                      width: `${widthPct}%`,
                      height: "11px",
                      backgroundColor: "rgba(255, 46, 84, 0.26)",
                      borderLeft: "2px solid var(--color-ask)",
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Spread & Imbalance Divider */}
        <div
          className="tabular-nums"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "4px 8px",
            margin: "3px 0",
            backgroundColor: "var(--bg-elevated)",
            borderTop: "1px solid var(--border-grid)",
            borderBottom: "1px solid var(--border-grid)",
            fontSize: "11px",
          }}
        >
          <div>
            <span style={{ color: "var(--text-secondary)" }}>MID: </span>
            <span style={{ color: "var(--text-primary)", fontWeight: 700 }}>
              {clobMidFormatted}
            </span>
          </div>
          <div>
            <span style={{ color: "var(--text-secondary)" }}>SPREAD: </span>
            <span
              style={{
                color:
                  spreadBps >= 20
                    ? "var(--color-chaos)"
                    : "var(--text-primary)",
                fontWeight: 700,
              }}
            >
              {spreadBps} bps
            </span>
          </div>
          <div>
            <span style={{ color: "var(--text-secondary)" }}>IMB: </span>
            <span
              style={{
                color:
                  imbalanceBps >= 0 ? "var(--color-bid)" : "var(--color-ask)",
                fontWeight: 700,
              }}
            >
              {imbalanceBps >= 0 ? `+${imbalanceBps}` : imbalanceBps} bps
            </span>
          </div>
        </div>

        {/* Bids Ladder */}
        <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
          {bids.map((bid, idx) => {
            const widthPct = Math.max(
              6,
              Math.min(100, Math.round((bid.cumulativeEth / maxCumEth) * 100))
            );
            return (
              <div
                key={`bid-${idx}-${bid.pricePips}`}
                onClick={() => onSelectPrice?.(bid.priceUsd, "ASK")}
                title="Click to sell at this Bid price"
                className="tabular-nums"
                style={{
                  display: "grid",
                  gridTemplateColumns: "40px 92px 72px 72px 1fr",
                  alignItems: "center",
                  height: "20px",
                  cursor: "pointer",
                  padding: "0 2px",
                }}
              >
                <span style={{ color: "var(--color-bid)", fontWeight: 700 }}>
                  BID
                </span>
                <span
                  style={{
                    textAlign: "right",
                    color: "var(--text-primary)",
                    fontWeight: 600,
                  }}
                >
                  {bid.priceFormatted}
                </span>
                <span
                  style={{ textAlign: "right", color: "var(--text-secondary)" }}
                >
                  {bid.qtyFormatted}
                </span>
                <span style={{ textAlign: "right", color: "var(--text-muted)" }}>
                  {bid.cumulativeEth.toFixed(2)}
                </span>
                <div
                  style={{
                    paddingLeft: "10px",
                    display: "flex",
                    alignItems: "center",
                  }}
                >
                  <div
                    style={{
                      width: `${widthPct}%`,
                      height: "11px",
                      backgroundColor: "rgba(0, 245, 155, 0.24)",
                      borderLeft: "2px solid var(--color-bid)",
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
