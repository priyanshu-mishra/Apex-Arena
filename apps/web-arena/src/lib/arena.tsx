"use client";

/**
 * ArenaProvider — the single owner of the simulation WebWorker.
 *
 * Every view reads live telemetry and dispatches commands through `useArena()`,
 * so switching views never pauses or re-creates the simulation.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  allocateTelemetryBuffer,
  type ArenaTelemetryFrame,
  type BenchmarkProgress,
  type BenchmarkResult,
  type CustomAgentConfig,
  type MarketRegimeLabel,
  type PricePointUi,
} from "./sharedBuffer";
import {
  createArenaWorker,
  type WorkerCommand,
  type WorkerEvent,
} from "../workers/arena.worker";
import { INITIAL_FRAME } from "./initialFrame";

export type ViewId = "overview" | "arena" | "lab" | "bench" | "arch";

export const VIEWS: { id: ViewId; label: string; short: string; key: string }[] = [
  { id: "overview", label: "Overview & tour", short: "Overview", key: "1" },
  { id: "arena", label: "Live trading arena", short: "Arena", key: "2" },
  { id: "lab", label: "Agent lab", short: "Agent lab", key: "3" },
  { id: "bench", label: "Chaos benchmark", short: "Benchmark", key: "4" },
  { id: "arch", label: "Architecture & proof", short: "Architecture", key: "5" },
];

export type ToastTone = "bid" | "ask" | "evm" | "chaos" | "llm";
export interface Toast {
  id: number;
  title: string;
  body?: string;
  tone: ToastTone;
}

export type OrderSide = "BID" | "ASK";
export type OrderType = "LIMIT" | "MARKET" | "POST_ONLY" | "IOC";
export type ScenarioId =
  | "flash-crash"
  | "whale-dump"
  | "toxic-flow"
  | "oracle-lag"
  | "bull-squeeze"
  | "drought";

export const SCENARIOS: { id: ScenarioId; label: string; description: string; tone: ToastTone }[] = [
  { id: "flash-crash", label: "350 bps flash crash", description: "Liquidity evaporates, Hawkes intensity spikes and the fundamental drops ~1.8%.", tone: "ask" },
  { id: "whale-dump", label: "Dump 450 ETH on Revm AMM", description: "A whale market-sells 450 ETH into the x·y=k pool, knocking on-chain spot below the CLOB.", tone: "evm" },
  { id: "toxic-flow", label: "MEV toxic flow", description: "Informed one-sided taker flow and a sandwich bundle; makers suffer adverse selection.", tone: "chaos" },
  { id: "oracle-lag", label: "Oracle update lag", description: "On-chain oracle lags the CLOB, opening a 54 bps cross-venue dislocation.", tone: "chaos" },
  { id: "bull-squeeze", label: "Bull liquidity squeeze", description: "Directional sweep lifts the CLOB +1.8% and the fundamental +2.2%.", tone: "bid" },
  { id: "drought", label: "Liquidity drought", description: "Depth thins out and makers widen quotes as Hawkes excitation rises.", tone: "chaos" },
];

export interface DeterminismState {
  status: "idle" | "running" | "pass" | "fail";
  hashes: string[];
  seed: number;
  ticks: number;
}

export interface BenchmarkState {
  running: boolean;
  progress: BenchmarkProgress | null;
  result: BenchmarkResult | null;
}

export interface TicketPrefill {
  priceUsd: number;
  side: OrderSide;
  nonce: number;
}

export interface ArenaApi {
  frame: ArenaTelemetryFrame;
  history: PricePointUi[];
  paused: boolean;
  speed: number;
  view: ViewId;
  setView: (v: ViewId) => void;
  determinism: DeterminismState;
  benchmark: BenchmarkState;
  toasts: Toast[];
  ticket: TicketPrefill | null;
  setTicket: (price: number, side: OrderSide) => void;
  paletteOpen: boolean;
  setPaletteOpen: (open: boolean) => void;
  actions: {
    togglePause: () => void;
    setPaused: (p: boolean) => void;
    step: (ticks?: number) => void;
    setSpeed: (ticksPerFrame: number) => void;
    reset: () => void;
    injectScenario: (s: ScenarioId) => void;
    setRegime: (r: MarketRegimeLabel) => void;
    submitOrder: (side: OrderSide, type: OrderType, priceUsd: number, qtyEth: number) => void;
    swap: (zeroForOne: boolean, amountIn: number) => void;
    captureArb: (sizeEth: number) => void;
    deployAgent: (config: CustomAgentConfig) => void;
    verifyDeterminism: (seed?: number, ticks?: number) => void;
    runBenchmark: (ticksPerStage?: number, seed?: number) => void;
    toast: (t: Omit<Toast, "id">) => void;
    dismissToast: (id: number) => void;
  };
}

const ArenaContext = createContext<ArenaApi | null>(null);

const HISTORY_CAP = 900;

function mergeHistory(prev: PricePointUi[], pt: PricePointUi): PricePointUi[] {
  const last = prev[prev.length - 1];
  if (last && pt.timeSec < last.timeSec) {
    // Never feed lightweight-charts a non-ascending timestamp.
    return prev;
  }
  if (last && last.timeSec === pt.timeSec) {
    return [...prev.slice(0, -1), pt];
  }
  const next = prev.length >= HISTORY_CAP ? prev.slice(prev.length - HISTORY_CAP + 1) : prev.slice();
  next.push(pt);
  return next;
}

function sanitizeHistory(points: PricePointUi[]): PricePointUi[] {
  const out: PricePointUi[] = [];
  for (const p of points) {
    const last = out[out.length - 1];
    if (!last || p.timeSec > last.timeSec) out.push(p);
    else if (p.timeSec === last.timeSec) out[out.length - 1] = p;
  }
  return out.slice(-HISTORY_CAP);
}

export function ArenaProvider({ children }: { children: React.ReactNode }) {
  const [frame, setFrame] = useState<ArenaTelemetryFrame>(INITIAL_FRAME);
  const [history, setHistory] = useState<PricePointUi[]>([]);
  const [paused, setPausedState] = useState(false);
  const [speed, setSpeedState] = useState(1);
  const [view, setViewState] = useState<ViewId>("overview");
  const [determinism, setDeterminism] = useState<DeterminismState>({
    status: "idle",
    hashes: [],
    seed: 42,
    ticks: 250,
  });
  const [benchmark, setBenchmark] = useState<BenchmarkState>({
    running: false,
    progress: null,
    result: null,
  });
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [ticket, setTicketState] = useState<TicketPrefill | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);

  const workerRef = useRef<Worker | null>(null);
  const pendingFrame = useRef<ArenaTelemetryFrame | null>(null);
  const historyRef = useRef<PricePointUi[]>([]);
  const historyDirty = useRef(false);
  const toastSeq = useRef(0);

  const toast = useCallback((t: Omit<Toast, "id">) => {
    const id = ++toastSeq.current;
    setToasts((prev) => [...prev.slice(-3), { ...t, id }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((x) => x.id !== id));
    }, 4200);
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((x) => x.id !== id));
  }, []);

  useEffect(() => {
    const worker = createArenaWorker();
    workerRef.current = worker;
    const { buffer, isShared } = allocateTelemetryBuffer();

    worker.onmessage = (ev: MessageEvent<WorkerEvent>) => {
      const data = ev.data;
      if (!data) return;
      if (data.type === "FRAME") {
        pendingFrame.current = data.frame;
        if (data.history && data.history.length > 0) {
          historyRef.current = sanitizeHistory(data.history);
        } else {
          historyRef.current = mergeHistory(historyRef.current, data.frame.latestPoint);
        }
        historyDirty.current = true;
      } else if (data.type === "DETERMINISM_RESULT") {
        setDeterminism({
          status: data.allEqual ? "pass" : "fail",
          hashes: data.hashes,
          seed: data.seed,
          ticks: data.ticks,
        });
      } else if (data.type === "BENCHMARK_PROGRESS") {
        setBenchmark((b) => ({
          ...b,
          running: data.progress < 1,
          progress: {
            stageIndex: data.stageIndex,
            stageCount: data.stageCount,
            stageName: data.stageName,
            progress: data.progress,
          },
        }));
      } else if (data.type === "BENCHMARK_RESULT") {
        setBenchmark((b) => ({ ...b, running: false, result: data.result }));
      }
    };

    const init: WorkerCommand = { type: "INIT", seed: 42, buffer, isShared };
    worker.postMessage(init);

    let raf = 0;
    const loop = () => {
      if (pendingFrame.current) {
        setFrame(pendingFrame.current);
        pendingFrame.current = null;
      }
      if (historyDirty.current) {
        setHistory(historyRef.current);
        historyDirty.current = false;
      }
      raf = window.requestAnimationFrame(loop);
    };
    raf = window.requestAnimationFrame(loop);

    return () => {
      window.cancelAnimationFrame(raf);
      worker.terminate();
      workerRef.current = null;
    };
  }, []);

  const send = useCallback((cmd: WorkerCommand) => {
    workerRef.current?.postMessage(cmd);
  }, []);

  const actions = useMemo<ArenaApi["actions"]>(
    () => ({
      togglePause: () => {
        setPausedState((p) => {
          send({ type: "SET_PAUSED", paused: !p });
          return !p;
        });
      },
      setPaused: (p) => {
        setPausedState(p);
        send({ type: "SET_PAUSED", paused: p });
      },
      step: (ticks = 1) => send({ type: "STEP_ONCE", ticks }),
      setSpeed: (n) => {
        setSpeedState(n);
        send({ type: "SET_SPEED", ticksPerFrame: n });
      },
      reset: () => {
        send({ type: "RESET", seed: 42 });
        toast({ title: "Simulation reset", body: "Arena restarted from the canonical seed 42.", tone: "evm" });
      },
      injectScenario: (s) => {
        send({ type: "INJECT_SCENARIO", scenario: s });
        const meta = SCENARIOS.find((x) => x.id === s);
        toast({ title: meta ? meta.label : s, body: meta?.description, tone: meta?.tone ?? "chaos" });
      },
      setRegime: (r) => {
        send({ type: "SET_REGIME", regime: r });
        toast({ title: `Regime set to ${r.toLowerCase()}`, tone: r === "FLASH CRASH" ? "ask" : "chaos" });
      },
      submitOrder: (side, type, priceUsd, qtyEth) => {
        send({ type: "SUBMIT_USER_ORDER", side, orderType: type, priceUsd, qtyEth });
        toast({
          title: `${side === "BID" ? "Buy" : "Sell"} ${qtyEth} ETH sent`,
          body: `${type.replace("_", "-")} order @ $${priceUsd.toFixed(2)} routed to the L3 CLOB.`,
          tone: side === "BID" ? "bid" : "ask",
        });
      },
      swap: (zeroForOne, amountIn) => {
        send({ type: "EXECUTE_USER_SWAP", zeroForOne, amountIn });
        toast({
          title: "Swap committed on Revm",
          body: zeroForOne ? `${amountIn} ETH → USDT through the x·y=k pool.` : `${amountIn} USDT → ETH through the x·y=k pool.`,
          tone: "evm",
        });
      },
      captureArb: (sizeEth) => {
        send({ type: "CAPTURE_ARB", sizeEth });
        toast({ title: "Atomic arbitrage executed", body: `${sizeEth} ETH routed across CLOB ↔ Revm. Check your receipts for PnL.`, tone: "evm" });
      },
      deployAgent: (config) => {
        send({ type: "DEPLOY_CUSTOM_AGENT", config });
        toast({ title: `Agent ${config.agentId} deployed`, body: "It now trades live and appears on the leaderboard.", tone: "llm" });
      },
      verifyDeterminism: (seed = 42, ticks = 250) => {
        setDeterminism({ status: "running", hashes: [], seed, ticks });
        send({ type: "VERIFY_5RUN_SHA256", seed, ticks });
      },
      runBenchmark: (ticksPerStage = 200, seed = 42) => {
        setBenchmark({ running: true, progress: { stageIndex: 0, stageCount: 4, stageName: "Calm baseline", progress: 0 }, result: null });
        send({ type: "RUN_BENCHMARK", seed, ticksPerStage });
      },
      toast,
      dismissToast,
    }),
    [send, toast, dismissToast]
  );

  const setView = useCallback((v: ViewId) => {
    setViewState(v);
    if (typeof window !== "undefined") window.scrollTo({ top: 0 });
  }, []);

  const setTicket = useCallback((priceUsd: number, side: OrderSide) => {
    setTicketState({ priceUsd, side, nonce: Date.now() });
  }, []);

  const api: ArenaApi = {
    frame,
    history,
    paused,
    speed,
    view,
    setView,
    determinism,
    benchmark,
    toasts,
    ticket,
    setTicket,
    paletteOpen,
    setPaletteOpen,
    actions,
  };

  return <ArenaContext.Provider value={api}>{children}</ArenaContext.Provider>;
}

export function useArena(): ArenaApi {
  const ctx = useContext(ArenaContext);
  if (!ctx) throw new Error("useArena must be used inside <ArenaProvider>");
  return ctx;
}

/* ---------- Shared derived helpers ---------- */

export const USER_AGENT_ID = "You (Live Desk)";
export const INITIAL_EQUITY_USD = 724000;
export const MAINTENANCE_MARGIN_PCT = 5;

export function fmtUsd(n: number, digits = 2): string {
  return (n < 0 ? "-$" : "$") + Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function fmtSigned(n: number, digits = 1, suffix = ""): string {
  return (n > 0 ? "+" : n < 0 ? "−" : "") + Math.abs(n).toFixed(digits) + suffix;
}

/** bps stored as basis points ×1 (e.g. psrBps 4100 → 0.41). */
export function bpsToUnit(bps: number): number {
  return bps / 10000;
}

export function regimeTone(r: MarketRegimeLabel): ToastTone {
  return r === "FLASH CRASH" ? "ask" : r === "LIQUIDITY DROUGHT" ? "chaos" : r === "TRENDING" ? "evm" : "bid";
}

export function displayAgentName(id: string): string {
  if (id === USER_AGENT_ID) return "You";
  return id;
}

export function agentKind(badge: string): { label: string; tone: ToastTone } {
  switch (badge) {
    case "[AI]":
      return { label: "LLM", tone: "llm" };
    case "[QT]":
      return { label: "Quant", tone: "evm" };
    case "[YOU]":
      return { label: "You", tone: "bid" };
    default:
      return { label: "Custom", tone: "chaos" };
  }
}
