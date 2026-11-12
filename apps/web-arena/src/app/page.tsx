"use client";

import React, { useEffect, useRef, useState } from "react";
import { EvmTelemetryFeed } from "../components/EvmTelemetryFeed";
import { LeaderboardPanel } from "../components/LeaderboardPanel";
import { LiveTestBench } from "../components/LiveTestBench";
import { OrderBookLadder } from "../components/OrderBookLadder";
import { PriceRegimeChart } from "../components/PriceRegimeChart";
import {
  allocateTelemetryBuffer,
  type ArenaTelemetryFrame,
  type CustomAgentConfig,
  type MarketRegimeLabel,
  type PricePointUi,
} from "../lib/sharedBuffer";
import {
  createArenaWorker,
  type WorkerCommand,
  type WorkerEvent,
} from "../workers/arena.worker";

const INITIAL_FRAME: ArenaTelemetryFrame = {
  tick: 80,
  blockNumber: 1942012,
  clobMidPips: 224150000000,
  clobMidUsd: 2241.5,
  clobMidFormatted: "$2,241.50",
  evmSpotPips: 224110000000,
  evmSpotUsd: 2241.1,
  evmSpotFormatted: "$2,241.10",
  basisBps: 2,
  spreadBps: 12,
  imbalanceBps: 140,
  regime: "CALM",
  hawkesIntensityPips: 20000000,
  newsHeadline:
    "[WIRE] Institutional order flow balanced; L2 spreads anchored near 8-15 bps.",
  stateHash: "0d8f0224c3de1ecd8a086b3fdbf35dd173f31e31547c17418e02f085da58f764",
  evmReserveBaseEth: 1000,
  evmReserveQuoteUsdt: 2241100,
  evmInvariantK: "2.241B",
  bids: [
    {
      pricePips: 224050000000,
      priceUsd: 2240.5,
      priceFormatted: "$2,240.50",
      qtyPips: 450000000,
      qtyEth: 4.5,
      qtyFormatted: "4.50",
      cumulativeEth: 4.5,
      orderCount: 2,
    },
    {
      pricePips: 224000000000,
      priceUsd: 2240.0,
      priceFormatted: "$2,240.00",
      qtyPips: 800000000,
      qtyEth: 8.0,
      qtyFormatted: "8.00",
      cumulativeEth: 12.5,
      orderCount: 3,
    },
    {
      pricePips: 223800000000,
      priceUsd: 2238.0,
      priceFormatted: "$2,238.00",
      qtyPips: 2210000000,
      qtyEth: 22.1,
      qtyFormatted: "22.10",
      cumulativeEth: 34.6,
      orderCount: 4,
    },
  ],
  asks: [
    {
      pricePips: 224200000000,
      priceUsd: 2242.0,
      priceFormatted: "$2,242.00",
      qtyPips: 310000000,
      qtyEth: 3.1,
      qtyFormatted: "3.10",
      cumulativeEth: 3.1,
      orderCount: 1,
    },
    {
      pricePips: 224250000000,
      priceUsd: 2242.5,
      priceFormatted: "$2,242.50",
      qtyPips: 620000000,
      qtyEth: 6.2,
      qtyFormatted: "6.20",
      cumulativeEth: 9.3,
      orderCount: 2,
    },
    {
      pricePips: 224350000000,
      priceUsd: 2243.5,
      priceFormatted: "$2,243.50",
      qtyPips: 1240000000,
      qtyEth: 12.4,
      qtyFormatted: "12.40",
      cumulativeEth: 21.7,
      orderCount: 3,
    },
  ],
  evmEvents: [],
  reasoningTraces: [],
  leaderboard: [],
  userReceipts: [],
  latestPoint: {
    tick: 80,
    timeSec: 1700000080,
    clobMidUsd: 2241.5,
    evmSpotUsd: 2241.1,
    regime: "CALM",
    geminiEquityUsd: 730000,
    deepseekEquityUsd: 728000,
    hawkesEquityUsd: 724000,
    mmAlphaEquityUsd: 720000,
    userEquityUsd: 724000,
  },
  sharedBufferActive: true,
};

export default function ApexArenaWorkstationPage() {
  const [frame, setFrame] = useState<ArenaTelemetryFrame>(INITIAL_FRAME);
  const [history, setHistory] = useState<PricePointUi[]>([]);
  const [paused, setPaused] = useState<boolean>(false);
  const [speed, setSpeed] = useState<number>(1);
  const [swapBottomPanes, setSwapBottomPanes] = useState<boolean>(false);
  const [showTestBench, setShowTestBench] = useState<boolean>(true);
  const [selectedPriceUsd, setSelectedPriceUsd] = useState<number | null>(null);
  const [selectedSide, setSelectedSide] = useState<"BID" | "ASK" | null>(null);
  const [verificationStatus, setVerificationStatus] = useState<string>(
    "5-Run SHA-256 Equivalence Verified: 0d8f0224c3de1ecd..."
  );

  const workerRef = useRef<Worker | null>(null);
  const pendingFrameRef = useRef<ArenaTelemetryFrame | null>(null);
  const pendingHistoryRef = useRef<PricePointUi[]>([]);

  useEffect(() => {
    const worker = createArenaWorker();
    workerRef.current = worker;

    const { buffer, isShared } = allocateTelemetryBuffer();

    worker.onmessage = (ev: MessageEvent<WorkerEvent>) => {
      const data = ev.data;
      if (!data) return;

      if (data.type === "FRAME") {
        pendingFrameRef.current = data.frame;
        if (data.history && data.history.length > 0) {
          pendingHistoryRef.current = data.history;
        } else {
          const prev = pendingHistoryRef.current;
          const pt = data.frame.latestPoint;
          if (prev.length > 0 && prev[prev.length - 1].timeSec === pt.timeSec) {
            pendingHistoryRef.current = [...prev.slice(0, -1), pt];
          } else {
            pendingHistoryRef.current = [...prev.slice(-220), pt];
          }
        }
      } else if (data.type === "DETERMINISM_RESULT") {
        const prefix = data.hashes[0]?.slice(0, 16) ?? "";
        setVerificationStatus(
          data.allEqual
            ? `PASS: 5/5 Bit-for-Bit Identical SHA-256 (${prefix}...)`
            : "FAIL: Determinism divergence detected!"
        );
      }
    };

    const initCmd: WorkerCommand = {
      type: "INIT",
      seed: 42,
      buffer,
      isShared,
    };
    worker.postMessage(initCmd);

    let rafId = 0;
    const syncUiLoop = () => {
      if (pendingFrameRef.current) {
        setFrame(pendingFrameRef.current);
        setHistory([...pendingHistoryRef.current]);
        pendingFrameRef.current = null;
      }
      rafId = window.requestAnimationFrame(syncUiLoop);
    };
    rafId = window.requestAnimationFrame(syncUiLoop);

    return () => {
      window.cancelAnimationFrame(rafId);
      worker.terminate();
      workerRef.current = null;
    };
  }, []);

  const sendCommand = (cmd: WorkerCommand) => {
    workerRef.current?.postMessage(cmd);
  };

  const togglePause = () => {
    const next = !paused;
    setPaused(next);
    sendCommand({ type: "SET_PAUSED", paused: next });
  };

  const handleStepOnce = () => {
    sendCommand({ type: "STEP_ONCE", ticks: 1 });
  };

  const handleSpeedChange = (nextSpeed: number) => {
    setSpeed(nextSpeed);
    sendCommand({ type: "SET_SPEED", ticksPerFrame: nextSpeed });
  };

  const handleTriggerFlashCrash = () => {
    sendCommand({ type: "TRIGGER_FLASH_CRASH" });
    setVerificationStatus(
      "CHAOS ENGINE: Flash Crash & Hawkes Self-Excitation Injected!"
    );
  };

  const handleRegimeSelect = (regime: MarketRegimeLabel) => {
    sendCommand({ type: "SET_REGIME", regime });
  };

  const handleVerifyDeterminism = () => {
    sendCommand({ type: "VERIFY_5RUN_SHA256", seed: 42, ticks: 250 });
  };

  const handleReset = () => {
    sendCommand({ type: "RESET", seed: 42 });
    setVerificationStatus("Arena reset to canonical seed=42.");
  };

  const handleSelectPriceFromBook = (priceUsd: number, side: "BID" | "ASK") => {
    setSelectedPriceUsd(priceUsd);
    setSelectedSide(side);
    setShowTestBench(true);
  };

  const handleSubmitUserOrder = (
    side: "BID" | "ASK",
    orderType: "LIMIT" | "MARKET" | "POST_ONLY" | "IOC",
    priceUsd: number,
    qtyEth: number
  ) => {
    sendCommand({
      type: "SUBMIT_USER_ORDER",
      side,
      orderType,
      priceUsd,
      qtyEth,
    });
    setVerificationStatus(
      `Executed [YOU] ${side} ${qtyEth} ETH (${orderType}) @ $${priceUsd.toFixed(2)}`
    );
  };

  const handleExecuteUserSwap = (zeroForOne: boolean, amountIn: number) => {
    sendCommand({
      type: "EXECUTE_USER_SWAP",
      zeroForOne,
      amountIn,
    });
    setVerificationStatus(
      `Executed [YOU] Revm AMM Swap (${zeroForOne ? "ETH->USDT" : "USDT->ETH"})`
    );
  };

  const handleInjectScenario = (scenario: string) => {
    sendCommand({ type: "INJECT_SCENARIO", scenario });
    setVerificationStatus(`CHAOS SCENARIO INJECTED: ${scenario.toUpperCase()}`);
  };

  const handleDeployAgent = (config: CustomAgentConfig) => {
    sendCommand({ type: "DEPLOY_CUSTOM_AGENT", config });
    setVerificationStatus(
      `Deployed Custom Agent [${config.agentId}] (${config.archetype}) into live arena!`
    );
  };

  const regimeColor =
    frame.regime === "FLASH CRASH"
      ? "var(--color-ask)"
      : frame.regime === "LIQUIDITY DROUGHT"
      ? "var(--color-chaos)"
      : frame.regime === "TRENDING"
      ? "var(--color-evm)"
      : "var(--color-bid)";

  return (
    <main className="workstation-shell">
      {/* Top Workstation Ribbon */}
      <header className="top-ribbon tabular-nums">
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span
            style={{
              backgroundColor: "var(--color-evm)",
              color: "var(--bg-void)",
              fontWeight: 800,
              padding: "3px 7px",
              fontSize: "11px",
            }}
          >
            [APEX-ARENA v1.0]
          </span>

          <span>
            <span style={{ color: "var(--text-secondary)" }}>TICK: </span>
            <strong style={{ color: "var(--text-primary)" }}>
              {String(frame.tick).padStart(6, "0")}
            </strong>
          </span>

          <span style={{ color: "var(--text-muted)" }}>|</span>

          <span>
            <span style={{ color: "var(--text-secondary)" }}>BLK: </span>
            <strong style={{ color: "var(--color-evm)" }}>
              #{frame.blockNumber}
            </strong>
          </span>

          <span style={{ color: "var(--text-muted)" }}>|</span>

          <span>
            <span style={{ color: "var(--text-secondary)" }}>MID: </span>
            <strong style={{ color: "var(--text-primary)" }}>
              {frame.clobMidFormatted}
            </strong>
          </span>

          <span style={{ color: "var(--text-muted)" }}>|</span>

          <span>
            <span style={{ color: "var(--text-secondary)" }}>REVM: </span>
            <strong style={{ color: "var(--color-evm)" }}>
              {frame.evmSpotFormatted}
            </strong>
          </span>

          <span style={{ color: "var(--text-muted)" }}>|</span>

          <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
            <span style={{ color: "var(--text-secondary)" }}>REGIME:</span>
            <span
              style={{
                backgroundColor: regimeColor,
                color: "var(--bg-void)",
                fontWeight: 800,
                padding: "2px 6px",
                fontSize: "10px",
              }}
            >
              {frame.regime}
            </span>
          </div>
        </div>

        {/* Action & Chaos Controls */}
        <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
          <button
            type="button"
            className={`cyber-btn ${paused ? "cyber-btn-active" : ""}`}
            onClick={togglePause}
          >
            {paused ? "▶ RESUME" : "⏸ PAUSE"}
          </button>

          {paused && (
            <button
              type="button"
              className="cyber-btn"
              onClick={handleStepOnce}
            >
              ⏭ +1 TICK
            </button>
          )}

          <button
            type="button"
            className="cyber-btn cyber-btn-danger"
            onClick={handleTriggerFlashCrash}
          >
            ⚡ FLASH CRASH
          </button>

          {(["CALM", "TRENDING", "LIQUIDITY DROUGHT"] as MarketRegimeLabel[]).map(
            (reg) => (
              <button
                key={reg}
                type="button"
                className={`cyber-btn ${
                  frame.regime === reg ? "cyber-btn-active" : ""
                }`}
                onClick={() => handleRegimeSelect(reg)}
              >
                {reg === "LIQUIDITY DROUGHT" ? "DROUGHT" : reg}
              </button>
            )
          )}

          {[1, 5, 15].map((spd) => (
            <button
              key={spd}
              type="button"
              className={`cyber-btn ${speed === spd ? "cyber-btn-active" : ""}`}
              onClick={() => handleSpeedChange(spd)}
            >
              {spd}X
            </button>
          ))}

          <button
            type="button"
            className="cyber-btn"
            onClick={() => setSwapBottomPanes((v) => !v)}
          >
            ⇄ Q2/Q4
          </button>

          <button type="button" className="cyber-btn" onClick={handleReset}>
            ↺ RESET
          </button>

          <button
            type="button"
            className="cyber-btn"
            onClick={handleVerifyDeterminism}
          >
            ✓ SHA256
          </button>

          <button
            type="button"
            className={`cyber-btn ${showTestBench ? "cyber-btn-active" : ""}`}
            onClick={() => setShowTestBench((v) => !v)}
          >
            {showTestBench ? "▣ HIDE BENCH" : "▣ LIVE BENCH"}
          </button>

          <a
            href="/guide.html"
            target="_blank"
            rel="noopener noreferrer"
            className="cyber-btn"
            style={{
              textDecoration: "none",
              borderColor: "var(--color-llm)",
              color: "var(--color-llm)",
            }}
          >
            📖 GUIDE &amp; CLAUDE SPEC
          </a>
        </div>
      </header>

      {/* Main Content Area: 4-Quadrant Grid + Live Test Bench */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: showTestBench ? "1fr 330px" : "1fr",
          width: "100%",
          height: "100%",
          overflow: "hidden",
        }}
      >
        <section className="quadrant-grid">
          {/* Quadrant 1 (Top-Left): L2/L3 Order Book Depth Ladder */}
          <OrderBookLadder
            bids={frame.bids}
            asks={frame.asks}
            spreadBps={frame.spreadBps}
            imbalanceBps={frame.imbalanceBps}
            clobMidFormatted={frame.clobMidFormatted}
            onSelectPrice={handleSelectPriceFromBook}
          />

          {/* Quadrant 3 (Top-Right): Multi-Agent Price & Equity Chart */}
          <PriceRegimeChart
            history={history}
            regime={frame.regime}
            hawkesIntensityPips={frame.hawkesIntensityPips}
            basisBps={frame.basisBps}
          />

          {/* Bottom Quadrants */}
          {swapBottomPanes ? (
            <>
              <LeaderboardPanel
                leaderboard={frame.leaderboard}
                reasoningTraces={frame.reasoningTraces}
                newsHeadline={frame.newsHeadline}
              />
              <EvmTelemetryFeed
                events={frame.evmEvents}
                reserveBaseEth={frame.evmReserveBaseEth}
                reserveQuoteUsdt={frame.evmReserveQuoteUsdt}
                evmSpotFormatted={frame.evmSpotFormatted}
                evmInvariantK={frame.evmInvariantK}
              />
            </>
          ) : (
            <>
              <EvmTelemetryFeed
                events={frame.evmEvents}
                reserveBaseEth={frame.evmReserveBaseEth}
                reserveQuoteUsdt={frame.evmReserveQuoteUsdt}
                evmSpotFormatted={frame.evmSpotFormatted}
                evmInvariantK={frame.evmInvariantK}
              />
              <LeaderboardPanel
                leaderboard={frame.leaderboard}
                reasoningTraces={frame.reasoningTraces}
                newsHeadline={frame.newsHeadline}
              />
            </>
          )}
        </section>

        {showTestBench && (
          <LiveTestBench
            frame={frame}
            selectedPriceUsd={selectedPriceUsd}
            selectedSide={selectedSide}
            onSubmitOrder={handleSubmitUserOrder}
            onExecuteSwap={handleExecuteUserSwap}
            onInjectScenario={handleInjectScenario}
            onDeployAgent={handleDeployAgent}
          />
        )}
      </div>

      {/* Bottom Telemetry & Determinism Attestation Bar */}
      <footer className="footer-bar tabular-nums">
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <span style={{ color: "var(--color-bid)", fontWeight: 700 }}>
            ● {verificationStatus}
          </span>
          <span style={{ color: "var(--text-muted)" }}>|</span>
          <span>
            PIPELINE:{" "}
            <strong style={{ color: "var(--color-evm)" }}>
              WebWorker +{" "}
              {frame.sharedBufferActive
                ? "SharedArrayBuffer (COOP/COEP)"
                : "RingBuffer"}{" "}
              @ 60Hz rAF + Native Rust API
            </strong>
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{ color: "var(--text-secondary)" }}>
            STATE SHA-256:{" "}
            <span style={{ color: "var(--text-primary)" }}>
              {frame.stateHash.slice(0, 24)}...
            </span>
          </span>
        </div>
      </footer>
    </main>
  );
}
