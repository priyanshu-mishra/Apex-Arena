"use client";

import React, { useEffect, useState } from "react";
import type {
  ArenaTelemetryFrame,
  CustomAgentConfig,
} from "../lib/sharedBuffer";

interface LiveTestBenchProps {
  frame: ArenaTelemetryFrame;
  selectedPriceUsd: number | null;
  selectedSide: "BID" | "ASK" | null;
  onSubmitOrder: (
    side: "BID" | "ASK",
    orderType: "LIMIT" | "MARKET" | "POST_ONLY" | "IOC",
    priceUsd: number,
    qtyEth: number
  ) => void;
  onExecuteSwap: (zeroForOne: boolean, amountIn: number) => void;
  onInjectScenario: (scenario: string) => void;
  onDeployAgent: (config: CustomAgentConfig) => void;
}

export function LiveTestBench({
  frame,
  selectedPriceUsd,
  selectedSide,
  onSubmitOrder,
  onExecuteSwap,
  onInjectScenario,
  onDeployAgent,
}: LiveTestBenchProps) {
  const [activeTab, setActiveTab] = useState<
    "ORDER" | "SWAP" | "LAB" | "BACKEND"
  >("ORDER");

  // Order Ticket State
  const [side, setSide] = useState<"BID" | "ASK">("BID");
  const [orderType, setOrderType] = useState<
    "LIMIT" | "MARKET" | "POST_ONLY" | "IOC"
  >("LIMIT");
  const [priceUsd, setPriceUsd] = useState<string>("2241.50");
  const [qtyEth, setQtyEth] = useState<string>("5.0");

  // Swap Widget State
  const [zeroForOne, setZeroForOne] = useState<boolean>(true); // true = ETH -> USDT
  const [swapAmount, setSwapAmount] = useState<string>("10.0");

  // Custom Agent Lab State
  const [customId, setCustomId] = useState<string>("Alpha-Neuro-v1");
  const [archetype, setArchetype] =
    useState<CustomAgentConfig["archetype"]>("NEURO_LLM_MM");
  const [baseSpreadBps, setBaseSpreadBps] = useState<number>(8);
  const [oodMult, setOodMult] = useState<number>(3.0);

  // Native Rust / MCP Backend State
  const [mcpTool, setMcpTool] = useState<string>("get_market_digest");
  const [backendBusy, setBackendBusy] = useState<boolean>(false);
  const [backendOutput, setBackendOutput] = useState<string>(
    'Click "RUN 5-PASS RUST SHA-256" or "CALL MCP TOOL" to query the native Rust & PyO3 engine.'
  );

  useEffect(() => {
    if (selectedPriceUsd !== null) {
      setPriceUsd(selectedPriceUsd.toFixed(2));
    }
    if (selectedSide !== null) {
      setSide(selectedSide);
    }
  }, [selectedPriceUsd, selectedSide]);

  const youEntry = frame.leaderboard.find(
    (r) => r.agentId === "You (Live Desk)"
  );

  // Estimate CFMM Swap output using exact 30bps constant-product formula
  const parsedSwapIn = Math.max(0, Number(swapAmount) || 0);
  const feeNetIn = parsedSwapIn * 0.997;
  const estimatedSwapOut = zeroForOne
    ? (frame.evmReserveQuoteUsdt * feeNetIn) /
      Math.max(1, frame.evmReserveBaseEth + feeNetIn)
    : (frame.evmReserveBaseEth * feeNetIn) /
      Math.max(1, frame.evmReserveQuoteUsdt + feeNetIn);

  const handleCaptureCrossVenueArb = () => {
    // If CLOB Mid > Revm Spot: Buy ETH on Revm (USDT -> ETH) and Sell ETH on CLOB
    if (frame.basisBps >= 0) {
      onExecuteSwap(false, 22000);
      onSubmitOrder("ASK", "MARKET", frame.clobMidUsd, 10.0);
    } else {
      // Revm Spot > CLOB Mid: Buy ETH on CLOB and Sell ETH on Revm (ETH -> USDT)
      onSubmitOrder("BID", "MARKET", frame.clobMidUsd, 10.0);
      onExecuteSwap(true, 10.0);
    }
  };

  const runRustBackendAction = async (
    action: "verify_rust_determinism" | "mcp_call"
  ) => {
    setBackendBusy(true);
    try {
      const toolArgsMap: Record<string, Record<string, unknown>> = {
        get_market_digest: { advance_ticks: 15 },
        get_orderbook_l2: { depth: 5 },
        submit_clob_order: {
          agent_id: "Claude-MCP-Trader",
          side: "BID",
          order_type: "LIMIT",
          price: frame.clobMidUsd,
          qty: 3.5,
        },
        execute_evm_swap: {
          agent_id: "Claude-MCP-Trader",
          zero_for_one: true,
          amount_in: 4.0,
        },
        trigger_chaos_regime: { regime: "flash-crash" },
        get_leaderboard: {},
        verify_determinism: { seed: 42, ticks: 200 },
      };

      const res = await fetch("/api/arena", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          action === "verify_rust_determinism"
            ? { action: "verify_rust_determinism", seed: 42, ticks: 300 }
            : {
                action: "mcp_call",
                seed: 42,
                toolName: mcpTool,
                toolArgs: toolArgsMap[mcpTool] ?? {},
              }
        ),
      });
      const json = await res.json();
      setBackendOutput(JSON.stringify(json, null, 2));
    } catch (err: unknown) {
      setBackendOutput(`Error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBackendBusy(false);
    }
  };

  return (
    <aside
      style={{
        display: "flex",
        flexDirection: "column",
        backgroundColor: "var(--bg-panel)",
        borderLeft: "1px solid var(--border-grid)",
        borderBottom: "1px solid var(--border-grid)",
        height: "100%",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div className="quadrant-header">
        <span style={{ color: "var(--color-bid)" }}>
          LIVE EXECUTION &amp; STRESS-TEST BENCH
        </span>
        <span style={{ color: "var(--text-secondary)", fontSize: "10px" }}>
          INTERACTIVE SANDBOX
        </span>
      </div>

      {/* Your Live Account Summary */}
      {youEntry && (
        <div
          className="tabular-nums"
          style={{
            padding: "6px 10px",
            backgroundColor: "var(--bg-elevated)",
            borderBottom: "1px solid var(--border-grid)",
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            gap: "6px",
            fontSize: "10.5px",
          }}
        >
          <div>
            <div style={{ color: "var(--text-secondary)", fontSize: "9.5px" }}>
              YOUR EQUITY
            </div>
            <div style={{ fontWeight: 700, color: "var(--text-primary)" }}>
              {youEntry.equityFormatted}
            </div>
          </div>
          <div>
            <div style={{ color: "var(--text-secondary)", fontSize: "9.5px" }}>
              INVENTORY
            </div>
            <div
              style={{
                fontWeight: 700,
                color:
                  youEntry.inventoryEth > 0
                    ? "var(--color-bid)"
                    : youEntry.inventoryEth < 0
                    ? "var(--color-ask)"
                    : "var(--text-primary)",
              }}
            >
              {youEntry.inventoryEth >= 0
                ? `+${youEntry.inventoryEth.toFixed(2)}`
                : youEntry.inventoryEth.toFixed(2)}{" "}
              ETH
            </div>
          </div>
          <div>
            <div style={{ color: "var(--text-secondary)", fontSize: "9.5px" }}>
              LIVE PNL (FILLS: {youEntry.totalFills})
            </div>
            <div
              style={{
                fontWeight: 700,
                color:
                  youEntry.pnlBps >= 0 ? "var(--color-bid)" : "var(--color-ask)",
              }}
            >
              {youEntry.pnlBps >= 0
                ? `+${(youEntry.pnlBps / 100).toFixed(2)}%`
                : `${(youEntry.pnlBps / 100).toFixed(2)}%`}
            </div>
          </div>
        </div>
      )}

      {/* Mode Tabs */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr 1fr",
          borderBottom: "1px solid var(--border-grid)",
          backgroundColor: "var(--bg-void)",
        }}
      >
        {(
          [
            { id: "ORDER", label: "1. CLOB" },
            { id: "SWAP", label: "2. REVM" },
            { id: "LAB", label: "3. LAB" },
            { id: "BACKEND", label: "4. MCP/RUST" },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            className="cyber-btn"
            style={{
              borderTop: "none",
              borderLeft: "none",
              borderBottom:
                activeTab === tab.id
                  ? "2px solid var(--color-evm)"
                  : "1px solid var(--border-grid)",
              color:
                activeTab === tab.id
                  ? "var(--text-primary)"
                  : "var(--text-secondary)",
              padding: "6px 2px",
              fontSize: "10px",
            }}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div
        className="tabular-nums"
        style={{
          padding: "10px",
          flex: 1,
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: "10px",
        }}
      >
        {activeTab === "ORDER" && (
          <>
            {/* Side Selector */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
              <button
                type="button"
                className="cyber-btn"
                style={{
                  backgroundColor:
                    side === "BID" ? "rgba(0, 245, 155, 0.18)" : "var(--bg-elevated)",
                  borderColor:
                    side === "BID" ? "var(--color-bid)" : "var(--border-grid)",
                  color: side === "BID" ? "var(--color-bid)" : "var(--text-secondary)",
                  padding: "7px",
                }}
                onClick={() => setSide("BID")}
              >
                ▲ BUY / BID (ETH)
              </button>
              <button
                type="button"
                className="cyber-btn"
                style={{
                  backgroundColor:
                    side === "ASK" ? "rgba(255, 46, 84, 0.18)" : "var(--bg-elevated)",
                  borderColor:
                    side === "ASK" ? "var(--color-ask)" : "var(--border-grid)",
                  color: side === "ASK" ? "var(--color-ask)" : "var(--text-secondary)",
                  padding: "7px",
                }}
                onClick={() => setSide("ASK")}
              >
                ▼ SELL / ASK (ETH)
              </button>
            </div>

            {/* Order Type */}
            <div>
              <div
                style={{
                  color: "var(--text-secondary)",
                  fontSize: "10px",
                  marginBottom: "4px",
                }}
              >
                ORDER EXECUTION TYPE
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr 1fr 1fr",
                  gap: "4px",
                }}
              >
                {(["LIMIT", "MARKET", "POST_ONLY", "IOC"] as const).map((ot) => (
                  <button
                    key={ot}
                    type="button"
                    className={`cyber-btn ${
                      orderType === ot ? "cyber-btn-active" : ""
                    }`}
                    style={{ padding: "4px 2px", fontSize: "9.5px" }}
                    onClick={() => setOrderType(ot)}
                  >
                    {ot}
                  </button>
                ))}
              </div>
            </div>

            {/* Limit Price Input */}
            <div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  color: "var(--text-secondary)",
                  fontSize: "10px",
                  marginBottom: "4px",
                }}
              >
                <span>PRICE (USD)</span>
                <div style={{ display: "flex", gap: "4px" }}>
                  <button
                    type="button"
                    className="cyber-btn"
                    style={{ padding: "0 4px", fontSize: "9px" }}
                    onClick={() =>
                      setPriceUsd((frame.clobMidUsd * 0.9985).toFixed(2))
                    }
                  >
                    -15bps
                  </button>
                  <button
                    type="button"
                    className="cyber-btn"
                    style={{ padding: "0 4px", fontSize: "9px" }}
                    onClick={() => setPriceUsd(frame.clobMidUsd.toFixed(2))}
                  >
                    MID
                  </button>
                  <button
                    type="button"
                    className="cyber-btn"
                    style={{ padding: "0 4px", fontSize: "9px" }}
                    onClick={() =>
                      setPriceUsd((frame.clobMidUsd * 1.0015).toFixed(2))
                    }
                  >
                    +15bps
                  </button>
                </div>
              </div>
              <input
                type="number"
                step="0.50"
                disabled={orderType === "MARKET"}
                value={orderType === "MARKET" ? frame.clobMidUsd : priceUsd}
                onChange={(e) => setPriceUsd(e.target.value)}
                style={{
                  width: "100%",
                  backgroundColor: "var(--bg-void)",
                  border: "1px solid var(--border-grid)",
                  color: "var(--text-primary)",
                  padding: "6px 8px",
                  fontFamily: "var(--font-mono)",
                  fontSize: "12px",
                }}
              />
            </div>

            {/* Quantity Input */}
            <div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  color: "var(--text-secondary)",
                  fontSize: "10px",
                  marginBottom: "4px",
                }}
              >
                <span>QUANTITY (ETH)</span>
                <div style={{ display: "flex", gap: "4px" }}>
                  {["2.0", "5.0", "15.0", "40.0"].map((q) => (
                    <button
                      key={q}
                      type="button"
                      className="cyber-btn"
                      style={{ padding: "0 4px", fontSize: "9px" }}
                      onClick={() => setQtyEth(q)}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
              <input
                type="number"
                step="1.0"
                value={qtyEth}
                onChange={(e) => setQtyEth(e.target.value)}
                style={{
                  width: "100%",
                  backgroundColor: "var(--bg-void)",
                  border: "1px solid var(--border-grid)",
                  color: "var(--text-primary)",
                  padding: "6px 8px",
                  fontFamily: "var(--font-mono)",
                  fontSize: "12px",
                }}
              />
            </div>

            <button
              type="button"
              className="cyber-btn"
              style={{
                width: "100%",
                padding: "8px",
                backgroundColor:
                  side === "BID"
                    ? "rgba(0, 245, 155, 0.22)"
                    : "rgba(255, 46, 84, 0.22)",
                borderColor:
                  side === "BID" ? "var(--color-bid)" : "var(--color-ask)",
                color: side === "BID" ? "var(--color-bid)" : "var(--color-ask)",
                fontWeight: 700,
              }}
              onClick={() =>
                onSubmitOrder(
                  side,
                  orderType,
                  Number(priceUsd) || frame.clobMidUsd,
                  Number(qtyEth) || 1.0
                )
              }
            >
              SUBMIT {side} ({orderType}) TO L3 CLOB
            </button>
          </>
        )}

        {activeTab === "SWAP" && (
          <>
            <div
              style={{
                padding: "6px 8px",
                backgroundColor: "var(--bg-elevated)",
                border: "1px solid var(--border-grid)",
                fontSize: "10.5px",
              }}
            >
              <div style={{ color: "var(--color-evm)", fontWeight: 700 }}>
                REVM CFMM POOL (0x0000..a9e8)
              </div>
              <div style={{ color: "var(--text-secondary)", marginTop: "2px" }}>
                Invariant ψ(R₁,R₂) = x · y = {frame.evmInvariantK} (Fee: 30bps)
              </div>
              <div style={{ marginTop: "2px" }}>
                CLOB vs Revm Basis:{" "}
                <strong style={{ color: "var(--color-chaos)" }}>
                  {frame.basisBps >= 0
                    ? `+${frame.basisBps}bps`
                    : `${frame.basisBps}bps`}
                </strong>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
              <button
                type="button"
                className={`cyber-btn ${zeroForOne ? "cyber-btn-active" : ""}`}
                onClick={() => {
                  setZeroForOne(true);
                  setSwapAmount("10.0");
                }}
              >
                ETH → USDT
              </button>
              <button
                type="button"
                className={`cyber-btn ${!zeroForOne ? "cyber-btn-active" : ""}`}
                onClick={() => {
                  setZeroForOne(false);
                  setSwapAmount("22000");
                }}
              >
                USDT → ETH
              </button>
            </div>

            <div>
              <div
                style={{
                  color: "var(--text-secondary)",
                  fontSize: "10px",
                  marginBottom: "4px",
                }}
              >
                INPUT AMOUNT ({zeroForOne ? "ETH" : "USDT"})
              </div>
              <input
                type="number"
                value={swapAmount}
                onChange={(e) => setSwapAmount(e.target.value)}
                style={{
                  width: "100%",
                  backgroundColor: "var(--bg-void)",
                  border: "1px solid var(--border-grid)",
                  color: "var(--text-primary)",
                  padding: "6px 8px",
                  fontFamily: "var(--font-mono)",
                }}
              />
            </div>

            <div
              style={{
                padding: "6px 8px",
                backgroundColor: "var(--bg-void)",
                border: "1px solid var(--border-grid)",
                fontSize: "10.5px",
              }}
            >
              <span style={{ color: "var(--text-secondary)" }}>
                EST. CFMM OUTPUT:{" "}
              </span>
              <strong style={{ color: "var(--color-evm)" }}>
                {estimatedSwapOut.toFixed(2)} {zeroForOne ? "USDT" : "ETH"}
              </strong>
            </div>

            <button
              type="button"
              className="cyber-btn"
              style={{
                width: "100%",
                padding: "8px",
                borderColor: "var(--color-evm)",
                color: "var(--color-evm)",
                backgroundColor: "rgba(56, 189, 248, 0.14)",
              }}
              onClick={() =>
                onExecuteSwap(zeroForOne, Math.max(0.1, Number(swapAmount) || 1))
              }
            >
              EXECUTE ON-CHAIN REVM SWAP
            </button>

            <button
              type="button"
              className="cyber-btn cyber-btn-danger"
              style={{ width: "100%", padding: "7px" }}
              onClick={handleCaptureCrossVenueArb}
            >
              ⚡ EXECUTE ATOMIC CLOB ↔ REVM ARBITRAGE
            </button>
          </>
        )}

        {activeTab === "LAB" && (
          <>
            <div>
              <div
                style={{
                  color: "var(--color-chaos)",
                  fontSize: "10px",
                  fontWeight: 700,
                  marginBottom: "4px",
                }}
              >
                INJECT ADVERSARIAL CHAOS SCENARIO
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "5px",
                }}
              >
                <button
                  type="button"
                  className="cyber-btn cyber-btn-danger"
                  onClick={() => onInjectScenario("flash-crash")}
                >
                  ⚡ FLASH CRASH
                </button>
                <button
                  type="button"
                  className="cyber-btn cyber-btn-danger"
                  onClick={() => onInjectScenario("oracle-lag")}
                >
                  🔮 ORACLE LAG
                </button>
                <button
                  type="button"
                  className="cyber-btn"
                  onClick={() => onInjectScenario("drought")}
                >
                  🏜️ LIQ DROUGHT
                </button>
                <button
                  type="button"
                  className="cyber-btn"
                  onClick={() => onInjectScenario("bull-squeeze")}
                >
                  📈 BULL SQUEEZE
                </button>
              </div>
            </div>

            <div
              style={{
                borderTop: "1px solid var(--border-grid)",
                paddingTop: "8px",
                display: "flex",
                flexDirection: "column",
                gap: "6px",
              }}
            >
              <div
                style={{
                  color: "var(--color-llm)",
                  fontSize: "10px",
                  fontWeight: 700,
                }}
              >
                DEPLOY CUSTOM AGENT TO LIVE ARENA
              </div>

              <input
                type="text"
                value={customId}
                onChange={(e) => setCustomId(e.target.value)}
                placeholder="Agent ID"
                style={{
                  width: "100%",
                  backgroundColor: "var(--bg-void)",
                  border: "1px solid var(--border-grid)",
                  color: "var(--text-primary)",
                  padding: "5px 8px",
                  fontFamily: "var(--font-mono)",
                  fontSize: "11px",
                }}
              />

              <select
                value={archetype}
                onChange={(e) =>
                  setArchetype(
                    e.target.value as CustomAgentConfig["archetype"]
                  )
                }
                style={{
                  width: "100%",
                  backgroundColor: "var(--bg-void)",
                  border: "1px solid var(--border-grid)",
                  color: "var(--text-primary)",
                  padding: "5px 8px",
                  fontFamily: "var(--font-mono)",
                  fontSize: "11px",
                }}
              >
                <option value="NEURO_LLM_MM">
                  Neuro-Symbolic LLM Market Maker
                </option>
                <option value="CROSS_VENUE_ARB">
                  Cross-Venue CLOB/Revm Arbitrageur
                </option>
                <option value="HAWKES_MOMENTUM">
                  Hawkes Toxicity Momentum
                </option>
                <option value="OU_MEAN_REV">
                  Ornstein-Uhlenbeck Mean Reversion
                </option>
              </select>

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: "10px",
                  color: "var(--text-secondary)",
                }}
              >
                <span>Base Half-Spread: {baseSpreadBps} bps</span>
                <span>OOD Shock Mult: {oodMult.toFixed(1)}x</span>
              </div>

              <input
                type="range"
                min={4}
                max={30}
                value={baseSpreadBps}
                onChange={(e) => setBaseSpreadBps(Number(e.target.value))}
              />
              <input
                type="range"
                min={10}
                max={50}
                value={oodMult * 10}
                onChange={(e) => setOodMult(Number(e.target.value) / 10)}
              />

              <button
                type="button"
                className="cyber-btn"
                style={{
                  borderColor: "var(--color-llm)",
                  color: "var(--color-llm)",
                  backgroundColor: "rgba(168, 85, 247, 0.14)",
                  padding: "7px",
                }}
                onClick={() =>
                  onDeployAgent({
                    agentId: customId,
                    archetype,
                    baseSpreadBps,
                    oodSpreadMultiplier: oodMult,
                    maxDrawdownLimitBps: 1800,
                    orderSizeEth: 4.0,
                  })
                }
              >
                + DEPLOY AGENT INTO TOURNAMENT
              </button>
            </div>
          </>
        )}

        {activeTab === "BACKEND" && (
          <>
            <div style={{ fontSize: "10px", color: "var(--text-secondary)" }}>
              Execute directly against the compiled Rust{" "}
              <code style={{ color: "var(--color-evm)" }}>apex-kernel</code> &amp;
              Python PyO3 MCP server:
            </div>

            <button
              type="button"
              disabled={backendBusy}
              className="cyber-btn cyber-btn-active"
              style={{ width: "100%", padding: "6px" }}
              onClick={() => runRustBackendAction("verify_rust_determinism")}
            >
              {backendBusy
                ? "RUNNING RUST KERNEL..."
                : "✓ RUN NATIVE RUST 5-PASS SHA-256"}
            </button>

            <div style={{ display: "flex", gap: "4px" }}>
              <select
                value={mcpTool}
                onChange={(e) => setMcpTool(e.target.value)}
                style={{
                  flex: 1,
                  backgroundColor: "var(--bg-void)",
                  border: "1px solid var(--border-grid)",
                  color: "var(--text-primary)",
                  padding: "5px",
                  fontFamily: "var(--font-mono)",
                  fontSize: "10.5px",
                }}
              >
                <option value="get_market_digest">mcp: get_market_digest</option>
                <option value="get_orderbook_l2">mcp: get_orderbook_l2</option>
                <option value="submit_clob_order">mcp: submit_clob_order</option>
                <option value="execute_evm_swap">mcp: execute_evm_swap</option>
                <option value="trigger_chaos_regime">
                  mcp: trigger_chaos_regime
                </option>
                <option value="get_leaderboard">mcp: get_leaderboard</option>
                <option value="verify_determinism">
                  mcp: verify_determinism
                </option>
              </select>
              <button
                type="button"
                disabled={backendBusy}
                className="cyber-btn"
                onClick={() => runRustBackendAction("mcp_call")}
              >
                CALL MCP
              </button>
            </div>

            <pre
              style={{
                backgroundColor: "var(--bg-void)",
                border: "1px solid var(--border-grid)",
                padding: "6px",
                fontSize: "9.5px",
                color: "var(--color-bid)",
                maxHeight: "190px",
                overflow: "auto",
                whiteSpace: "pre-wrap",
              }}
            >
              {backendOutput}
            </pre>
          </>
        )}

        {/* Live User Execution Receipts Log */}
        {activeTab !== "BACKEND" && (
          <div
            style={{
              marginTop: "auto",
              borderTop: "1px solid var(--border-grid)",
              paddingTop: "6px",
            }}
          >
            <div
              style={{
                fontSize: "9.5px",
                color: "var(--text-secondary)",
                marginBottom: "4px",
              }}
            >
              RECENT LIVE EXECUTION RECEIPTS ({frame.userReceipts.length})
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "3px",
                maxHeight: "115px",
                overflowY: "auto",
              }}
            >
              {frame.userReceipts.length === 0 ? (
                <div style={{ fontSize: "10px", color: "var(--text-muted)" }}>
                  No manual trades yet. Click an order book row or submit a CLOB
                  order / Revm swap above!
                </div>
              ) : (
                frame.userReceipts.slice(0, 5).map((rec) => (
                  <div
                    key={rec.id}
                    style={{
                      padding: "3px 6px",
                      backgroundColor: "var(--bg-void)",
                      borderLeft:
                        rec.side === "BID"
                          ? "2px solid var(--color-bid)"
                          : rec.side === "ASK"
                          ? "2px solid var(--color-ask)"
                          : "2px solid var(--color-evm)",
                      fontSize: "9.5px",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        fontWeight: 700,
                      }}
                    >
                      <span>
                        [{rec.venue}] {rec.side} {rec.qtyFormatted} @{" "}
                        {rec.priceFormatted}
                      </span>
                      <span style={{ color: "var(--color-bid)" }}>
                        {rec.status}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
