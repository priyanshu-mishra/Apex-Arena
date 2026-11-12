"use client";

import React from "react";
import type { LeaderboardEntryUi, ReasoningTraceUi } from "../lib/sharedBuffer";

interface LeaderboardPanelProps {
  leaderboard: LeaderboardEntryUi[];
  reasoningTraces: ReasoningTraceUi[];
  newsHeadline: string;
}

export function LeaderboardPanel({
  leaderboard,
  reasoningTraces,
  newsHeadline,
}: LeaderboardPanelProps) {
  return (
    <div className="quadrant-pane" tabIndex={0}>
      <div className="quadrant-header">
        <span>QUADRANT 4: LIVE LEADERBOARD &amp; MACRO LLM REASONING</span>
        <span
          style={{
            color: "var(--color-llm)",
            fontFamily: "var(--font-mono)",
            fontSize: "10px",
          }}
        >
          ACS = 0.40·PSR + 0.30·CALMAR + 0.20·OOD - 0.10·TURN
        </span>
      </div>

      <div
        className="quadrant-body tabular-nums"
        style={{
          justifyContent: "space-between",
          padding: "6px 10px",
          overflowY: "auto",
        }}
      >
        {/* Leaderboard Table */}
        <div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1.45fr 0.95fr 0.75fr 0.75fr 0.75fr 0.7fr 0.7fr 0.55fr",
              color: "var(--text-secondary)",
              fontSize: "10px",
              padding: "3px 6px",
              backgroundColor: "var(--bg-elevated)",
              borderBottom: "1px solid var(--border-grid)",
            }}
          >
            <span>AGENT</span>
            <span style={{ textAlign: "right" }}>EQUITY</span>
            <span style={{ textAlign: "right" }}>INV(ETH)</span>
            <span style={{ textAlign: "right" }}>PNL</span>
            <span style={{ textAlign: "right" }}>MAX DD</span>
            <span style={{ textAlign: "right" }}>PSR(0)</span>
            <span style={{ textAlign: "right" }}>ACS</span>
            <span style={{ textAlign: "right" }}>STAT</span>
          </div>

          {leaderboard.map((row) => {
            const pnlPct = (row.pnlBps / 100).toFixed(1);
            const ddPct = (row.maxDrawdownBps / 100).toFixed(1);
            const psrPct = (row.psrBps / 100).toFixed(1);
            const acsScore = (row.acsScoreBps / 100).toFixed(1);
            const isPositive = row.pnlBps >= 0;
            const isLiq = row.status === "LIQ";
            const isYou = row.badge === "[YOU]";

            const badgeColor =
              row.badge === "[AI]"
                ? "var(--color-llm)"
                : row.badge === "[YOU]"
                ? "var(--color-bid)"
                : row.badge === "[CUST]"
                ? "var(--color-chaos)"
                : "var(--color-evm)";

            return (
              <div
                key={row.agentId}
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "1.45fr 0.95fr 0.75fr 0.75fr 0.75fr 0.7fr 0.7fr 0.55fr",
                  alignItems: "center",
                  padding: "3.5px 6px",
                  borderBottom: "1px solid var(--border-grid)",
                  backgroundColor: isLiq
                    ? "rgba(255, 46, 84, 0.08)"
                    : isYou
                    ? "rgba(0, 245, 155, 0.06)"
                    : "transparent",
                }}
              >
                <span style={{ fontWeight: 600 }}>
                  <span style={{ color: badgeColor, marginRight: "4px" }}>
                    {row.badge}
                  </span>
                  {row.agentId}
                </span>
                <span style={{ textAlign: "right", fontWeight: 600 }}>
                  {row.equityFormatted}
                </span>
                <span
                  style={{
                    textAlign: "right",
                    color:
                      row.inventoryEth > 0
                        ? "var(--color-bid)"
                        : row.inventoryEth < 0
                        ? "var(--color-ask)"
                        : "var(--text-muted)",
                  }}
                >
                  {row.inventoryEth > 0
                    ? `+${row.inventoryEth.toFixed(1)}`
                    : row.inventoryEth.toFixed(1)}
                </span>
                <span
                  style={{
                    textAlign: "right",
                    color: isPositive ? "var(--color-bid)" : "var(--color-ask)",
                    fontWeight: 700,
                  }}
                >
                  {isPositive ? `+${pnlPct}%` : `${pnlPct}%`}
                </span>
                <span
                  style={{ textAlign: "right", color: "var(--text-secondary)" }}
                >
                  {ddPct}%
                </span>
                <span
                  style={{ textAlign: "right", color: "var(--text-secondary)" }}
                >
                  {psrPct}%
                </span>
                <span
                  style={{
                    textAlign: "right",
                    color: isLiq ? "var(--color-ask)" : "var(--color-evm)",
                    fontWeight: 700,
                  }}
                >
                  {acsScore}
                </span>
                <span
                  style={{
                    textAlign: "right",
                    color: isLiq ? "var(--color-ask)" : "var(--color-bid)",
                    fontWeight: 700,
                  }}
                >
                  {row.status}
                </span>
              </div>
            );
          })}
        </div>

        {/* Live Macro Barrier Reasoning & MCP Tool Trace */}
        <div
          style={{
            marginTop: "4px",
            borderTop: "1px solid var(--border-grid)",
            paddingTop: "5px",
            display: "flex",
            flexDirection: "column",
            gap: "3px",
          }}
        >
          <div
            style={{
              fontSize: "10px",
              color: "var(--color-chaos)",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {newsHeadline}
          </div>

          {reasoningTraces.slice(0, 2).map((tr, idx) => (
            <div
              key={`${tr.agentId}-${tr.tick}-${idx}`}
              style={{
                padding: "3px 6px",
                backgroundColor: "var(--bg-elevated)",
                borderLeft: "2px solid var(--color-llm)",
                fontSize: "10px",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--color-llm)", fontWeight: 700 }}>
                  [MACRO BARRIER T+{tr.tick}] {tr.agentId}
                </span>
                <span style={{ color: "var(--color-evm)" }}>{tr.toolAction}</span>
              </div>
              <div style={{ color: "var(--text-secondary)", marginTop: "1px" }}>
                {tr.thoughtSummary}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
