/**
 * Dedicated WebWorker for ApexArena Off-Main-Thread Simulation & Live Trading Desk.
 */

import type {
  BenchmarkResult,
  ArenaTelemetryFrame,
  CustomAgentConfig,
  MarketRegimeLabel,
} from "../lib/sharedBuffer";

export type WorkerCommand =
  | {
      type: "INIT";
      seed: number;
      buffer: SharedArrayBuffer | ArrayBuffer;
      isShared: boolean;
    }
  | { type: "SET_PAUSED"; paused: boolean }
  | { type: "SET_SPEED"; ticksPerFrame: number }
  | { type: "STEP_ONCE"; ticks: number }
  | { type: "TRIGGER_FLASH_CRASH" }
  | { type: "INJECT_SCENARIO"; scenario: string }
  | { type: "SET_REGIME"; regime: MarketRegimeLabel }
  | {
      type: "SUBMIT_USER_ORDER";
      side: "BID" | "ASK";
      orderType: "LIMIT" | "MARKET" | "POST_ONLY" | "IOC";
      priceUsd: number;
      qtyEth: number;
    }
  | {
      type: "EXECUTE_USER_SWAP";
      zeroForOne: boolean;
      amountIn: number;
    }
  | {
      type: "DEPLOY_CUSTOM_AGENT";
      config: CustomAgentConfig;
    }
  | { type: "RESET"; seed: number }
  | { type: "VERIFY_5RUN_SHA256"; seed: number; ticks: number }
  | { type: "CAPTURE_ARB"; sizeEth: number }
  | { type: "RUN_BENCHMARK"; seed: number; ticksPerStage: number };

export type WorkerEvent =
  | {
      type: "FRAME";
      frame: ArenaTelemetryFrame;
      history?: ArenaTelemetryFrame["latestPoint"][];
    }
  | {
      type: "DETERMINISM_RESULT";
      seed: number;
      ticks: number;
      runs: number;
      allEqual: boolean;
      hashes: string[];
    }
  | {
      type: "BENCHMARK_PROGRESS";
      stageIndex: number;
      stageCount: number;
      stageName: string;
      progress: number;
    }
  | {
      type: "BENCHMARK_RESULT";
      result: BenchmarkResult;
    };

const WORKER_SOURCE = `
const SCALE = 100000000;
const BPS_SCALE = 10000;

const REGIMES = ["CALM", "TRENDING", "LIQUIDITY DROUGHT", "FLASH CRASH"];
const TRANSITION_MATRIX = [
  [980, 10, 5, 5],
  [30, 940, 20, 10],
  [50, 20, 900, 30],
  [80, 10, 10, 900]
];

function createSeededRng(seed) {
  let state = (seed >>> 0) || 42;
  return function nextU32() {
    state = (state + 0x6D2B79F5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0);
  };
}

function fnv256Hex(parts) {
  const lanes = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
  ];
  const str = parts.join("|");
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    const laneIdx = i & 7;
    lanes[laneIdx] = Math.imul(lanes[laneIdx] ^ c, 16777619) >>> 0;
    lanes[(laneIdx + 3) & 7] = (lanes[(laneIdx + 3) & 7] + ((lanes[laneIdx] << 5) | (lanes[laneIdx] >>> 27))) >>> 0;
  }
  return lanes.map(x => x.toString(16).padStart(8, "0")).join("");
}

function formatDollarsPips(pips) {
  const whole = Math.floor(Math.abs(pips) / SCALE);
  const cents = Math.floor((Math.abs(pips) % SCALE) / (SCALE / 100));
  return "$" + whole.toLocaleString("en-US") + "." + String(cents).padStart(2, "0");
}

function formatQtyPips(pips) {
  const whole = Math.floor(Math.abs(pips) / SCALE);
  const frac = Math.floor((Math.abs(pips) % SCALE) / (SCALE / 100));
  return whole + "." + String(frac).padStart(2, "0");
}

class DeterministicKernel {
  constructor(seed) {
    this.reset(seed);
  }

  reset(seed) {
    this.seed = seed;
    this.rng = createSeededRng(seed);
    this.tick = 0;
    this.blockNumber = 1942000;
    this.regimeCode = 0;
    this.regimeLock = 0;
    this.hawkesExcitationPips = 0;
    this.fundamentalPips = 224150000000; // $2,241.50
    this.clobMidPips = 224150000000;
    this.reserveBasePips = 1000 * SCALE;
    this.reserveQuotePips = 2241500 * SCALE;
    this.spreadBps = 12;
    this.imbalanceBps = 140;
    this.swapNonce = 0;
    this.evmEvents = [];
    this.reasoningTraces = [];
    this.userReceipts = [];
    this.restingUserOrders = [];
    this.customAgentConfigs = {};

    this.agents = {
      "Gemini-2.5": {
        agentId: "Gemini-2.5",
        badge: "[AI]",
        status: "ACT",
        initialEquityPips: 724000 * SCALE,
        cashQuotePips: 840548 * SCALE,
        inventoryBasePips: -52 * SCALE,
        peakEquityPips: 724000 * SCALE,
        maxDrawdownBps: 18,
        psrBps: 9420,
        calmarBps: 8850,
        oodSurvivalBps: 9380,
        totalFills: 14,
        spreadBps: 8
      },
      "DeepSeek-R1": {
        agentId: "DeepSeek-R1",
        badge: "[AI]",
        status: "ACT",
        initialEquityPips: 724000 * SCALE,
        cashQuotePips: 804694 * SCALE,
        inventoryBasePips: -36 * SCALE,
        peakEquityPips: 724000 * SCALE,
        maxDrawdownBps: 29,
        psrBps: 8940,
        calmarBps: 8210,
        oodSurvivalBps: 8910,
        totalFills: 12,
        spreadBps: 10
      },
      "You (Live Desk)": {
        agentId: "You (Live Desk)",
        badge: "[YOU]",
        status: "ACT",
        initialEquityPips: 724000 * SCALE,
        cashQuotePips: 724000 * SCALE,
        inventoryBasePips: 0,
        peakEquityPips: 724000 * SCALE,
        maxDrawdownBps: 0,
        psrBps: 7500,
        calmarBps: 7500,
        oodSurvivalBps: 8500,
        totalFills: 0,
        spreadBps: 6
      },
      "Hawkes-HFT": {
        agentId: "Hawkes-HFT",
        badge: "[QT]",
        status: "ACT",
        initialEquityPips: 724000 * SCALE,
        cashQuotePips: 674687 * SCALE,
        inventoryBasePips: 22 * SCALE,
        peakEquityPips: 724000 * SCALE,
        maxDrawdownBps: 64,
        psrBps: 6810,
        calmarBps: 6120,
        oodSurvivalBps: 7150,
        totalFills: 38,
        spreadBps: 5
      },
      "MM-Alpha": {
        agentId: "MM-Alpha",
        badge: "[QT]",
        status: "ACT",
        initialEquityPips: 724000 * SCALE,
        cashQuotePips: 123278 * SCALE,
        inventoryBasePips: 268 * SCALE,
        peakEquityPips: 724000 * SCALE,
        maxDrawdownBps: 45,
        psrBps: 4100,
        calmarBps: 3100,
        oodSurvivalBps: 3800,
        totalFills: 29,
        spreadBps: 4
      }
    };

    this.pushEvmEvent(
      "0x71a9",
      "Gemini-2.5",
      "CONTRACT_DEPLOY",
      4,
      "[BLK #1942000] 0x71a9.. CALL swapExactTokens (Router 0x00..a9e8 Initialized)"
    );
    this.emitMacroReasoning();
  }

  randRange(min, maxInclusive) {
    const r = this.rng();
    return min + (r % (maxInclusive - min + 1));
  }

  evmSpotPips() {
    return Math.floor((this.reserveQuotePips / this.reserveBasePips) * SCALE);
  }

  triggerFlashCrash() {
    this.regimeCode = 3;
    this.regimeLock = 55;
    this.hawkesExcitationPips += 240000000;
    this.fundamentalPips = Math.floor(this.fundamentalPips * 0.982);
    this.blockNumber += 1;
    this.pushEvmEvent(
      "0x33b8",
      "ChaosEngine",
      "ARB_SLIPPAGE",
      42,
      "[BLK #" + this.blockNumber + "] 0x33b8.. ARB SLIPPAGE: 42bps | FLASH CRASH CASCADE"
    );
    this.emitMacroReasoning();
    // Advance 1 tick so timestamp is strictly monotonic
    this.step();
  }

  injectScenario(scenario) {
    if (scenario === "flash-crash") {
      this.triggerFlashCrash();
      return;
    }
    if (scenario === "oracle-lag") {
      this.regimeCode = 2;
      this.regimeLock = 40;
      this.hawkesExcitationPips += 145000000;
      this.fundamentalPips = Math.floor(this.fundamentalPips * 1.016);
      this.blockNumber += 1;
      this.pushEvmEvent(
        "0x01f9",
        "0x01f..oracle",
        "ORACLE_UPDATE_LAG",
        54,
        "[BLK #" + this.blockNumber + "] 0x01f9.. ORACLE UPDATE LAG: 54bps CLOB/Revm Dislocation!"
      );
      this.emitMacroReasoning();
      this.step();
      return;
    }
    if (scenario === "bull-squeeze") {
      this.regimeCode = 1;
      this.regimeLock = 45;
      this.fundamentalPips = Math.floor(this.fundamentalPips * 1.022);
      this.clobMidPips = Math.floor(this.clobMidPips * 1.018);
      this.blockNumber += 1;
      this.pushEvmEvent(
        "0xb42a",
        "Hawkes-HFT",
        "CALL_SWAP_EXACT",
        29,
        "[BLK #" + this.blockNumber + "] 0xb42a.. CALL swapExactTokens (Bull Liquidity Sweep +2.2%)"
      );
      this.emitMacroReasoning();
      this.step();
      return;
    }
    if (scenario === "whale-dump") {
      // 450 ETH whale market-sells into the Revm x*y=k pool (30 bps fee)
      const whaleIn = 450 * SCALE;
      const feeNet = Math.floor(whaleIn * 9970 / 10000);
      const usdtOut = Math.floor((this.reserveQuotePips * feeNet) / (this.reserveBasePips + feeNet));
      const spotBefore = this.evmSpotPips();
      this.reserveBasePips += whaleIn;
      this.reserveQuotePips -= usdtOut;
      const spotAfter = this.evmSpotPips();
      const impactBps = Math.floor(((spotBefore - spotAfter) * 10000) / Math.max(1, spotBefore));
      this.regimeCode = 1;
      this.regimeLock = 45;
      this.hawkesExcitationPips += 120000000;
      this.swapNonce += 1;
      this.blockNumber += 1;
      this.pushEvmEvent(
        "0x450e",
        "0xWhale..d00d",
        "WHALE_DUMP_450_ETH",
        impactBps,
        "[BLK #" + this.blockNumber + "] 0x450e.. WHALE SWAP 450.00 ETH->" + formatQtyPips(usdtOut) + " USDT | pool impact " + impactBps + "bps"
      );
      this.emitMacroReasoning();
      this.step();
      return;
    }
    if (scenario === "toxic-flow") {
      // Informed (MEV / toxic) taker flow: one-sided aggression, adverse selection for makers
      this.regimeCode = 2;
      this.regimeLock = 50;
      this.hawkesExcitationPips += 180000000;
      this.imbalanceBps = -2600;
      this.fundamentalPips = Math.floor(this.fundamentalPips * 0.991);
      this.blockNumber += 1;
      this.pushEvmEvent(
        "0x70c1",
        "0xMEV..searcher",
        "TOXIC_FLOW_SANDWICH",
        37,
        "[BLK #" + this.blockNumber + "] 0x70c1.. MEV TOXIC FLOW: sandwich bundle front-ran pool, 37bps adverse selection"
      );
      this.emitMacroReasoning();
      this.step();
      return;
    }
    if (scenario === "drought") {
      this.regimeCode = 2;
      this.regimeLock = 45;
      this.hawkesExcitationPips += 160000000;
      this.emitMacroReasoning();
      this.step();
    }
  }

  setRegime(regimeLabel) {
    const idx = REGIMES.indexOf(regimeLabel);
    if (idx >= 0) {
      if (idx === 3) {
        this.triggerFlashCrash();
      } else {
        this.regimeCode = idx;
        this.regimeLock = 40;
        this.emitMacroReasoning();
        this.step();
      }
    }
  }

  submitUserOrder(side, orderType, priceUsd, qtyEth) {
    const user = this.agents["You (Live Desk)"];
    const qtyPips = Math.max(1000000, Math.round(Number(qtyEth) * SCALE));
    const limitPips = Math.max(100 * SCALE, Math.round(Number(priceUsd) * SCALE));
    const halfSpreadPips = Math.floor((this.clobMidPips * this.spreadBps) / 20000);
    const bestBidPips = this.clobMidPips - halfSpreadPips;
    const bestAskPips = this.clobMidPips + halfSpreadPips;

    let fillsNow = false;
    let execPricePips = limitPips;

    if (orderType === "MARKET") {
      fillsNow = true;
      execPricePips = side === "BID" ? bestAskPips : bestBidPips;
    } else if (orderType === "POST_ONLY") {
      const crosses = (side === "BID" && limitPips >= bestAskPips) || (side === "ASK" && limitPips <= bestBidPips);
      if (crosses) {
        this.step();
        this.userReceipts.unshift({
          id: "ord-" + this.tick + "-" + this.userReceipts.length,
          tick: this.tick,
          venue: "CLOB",
          side: side,
          orderType: orderType,
          priceFormatted: formatDollarsPips(limitPips),
          qtyFormatted: formatQtyPips(qtyPips) + " ETH",
          status: "REJECTED (POST-ONLY CROSS)",
          detail: "Post-Only order crossed best opposing quote and was rejected."
        });
        return;
      }
      fillsNow = false;
    } else {
      // LIMIT or IOC
      if (side === "BID" && limitPips >= bestAskPips) {
        fillsNow = true;
        execPricePips = bestAskPips;
      } else if (side === "ASK" && limitPips <= bestBidPips) {
        fillsNow = true;
        execPricePips = bestBidPips;
      }
    }

    if (fillsNow) {
      const notionalPips = Math.floor((execPricePips / SCALE) * qtyPips);
      const feePips = Math.floor(notionalPips * 4 / 10000);
      if (side === "BID") {
        user.inventoryBasePips += qtyPips;
        user.cashQuotePips -= (notionalPips + feePips);
        // Endogenous Kyle price impact
        this.clobMidPips += Math.floor((qtyPips / SCALE) * 4500000);
      } else {
        user.inventoryBasePips -= qtyPips;
        user.cashQuotePips += (notionalPips - feePips);
        this.clobMidPips -= Math.floor((qtyPips / SCALE) * 4500000);
      }
      user.totalFills += 1;
      this.step();
      this.userReceipts.unshift({
        id: "ord-" + this.tick + "-" + this.userReceipts.length,
        tick: this.tick,
        venue: "CLOB",
        side: side,
        orderType: orderType,
        priceFormatted: formatDollarsPips(execPricePips),
        qtyFormatted: formatQtyPips(qtyPips) + " ETH",
        status: "FILLED",
        detail: "Executed on L3 CLOB (4bps taker fee); endogenous impact shifted mid."
      });
    } else if (orderType === "IOC") {
      this.step();
      this.userReceipts.unshift({
        id: "ord-" + this.tick + "-" + this.userReceipts.length,
        tick: this.tick,
        venue: "CLOB",
        side: side,
        orderType: orderType,
        priceFormatted: formatDollarsPips(limitPips),
        qtyFormatted: formatQtyPips(qtyPips) + " ETH",
        status: "CANCELED (IOC UNFILLED)",
        detail: "IOC limit did not cross top-of-book and was immediately canceled."
      });
    } else {
      this.restingUserOrders.push({
        side: side,
        pricePips: limitPips,
        qtyPips: qtyPips
      });
      this.step();
      this.userReceipts.unshift({
        id: "ord-" + this.tick + "-" + this.userReceipts.length,
        tick: this.tick,
        venue: "CLOB",
        side: side,
        orderType: orderType,
        priceFormatted: formatDollarsPips(limitPips),
        qtyFormatted: formatQtyPips(qtyPips) + " ETH",
        status: "RESTING ON L3 BOOK",
        detail: "Resting in price-time priority queue; will fill when market crosses."
      });
    }
    if (this.userReceipts.length > 20) this.userReceipts.length = 20;
  }

  executeUserSwap(zeroForOne, amountIn) {
    const user = this.agents["You (Live Desk)"];
    const inPips = Math.max(1000000, Math.round(Number(amountIn) * SCALE));
    const feeNet = Math.floor(inPips * 9970 / 10000);
    const spotBefore = this.evmSpotPips();
    this.swapNonce += 1;
    this.blockNumber += 1;
    const hashPrefix = "0x" + fnv256Hex(["USER_SWAP", this.tick, this.swapNonce]).slice(0, 4);

    if (zeroForOne) {
      // ETH -> USDT
      const usdtOutPips = Math.floor((this.reserveQuotePips * feeNet) / (this.reserveBasePips + feeNet));
      this.reserveBasePips += inPips;
      this.reserveQuotePips -= usdtOutPips;
      user.inventoryBasePips -= inPips;
      user.cashQuotePips += usdtOutPips;
      user.totalFills += 1;
      const effPrice = Math.floor((usdtOutPips / inPips) * SCALE);
      const slipBps = Math.abs(Math.floor(((effPrice - spotBefore) * 10000) / Math.max(1, spotBefore)));
      const logLine = "[BLK #" + this.blockNumber + "] " + hashPrefix + ".. [YOU] SWAP " + formatQtyPips(inPips) + " ETH->" + formatQtyPips(usdtOutPips) + " USDT";
      this.pushEvmEvent(hashPrefix, "You (Live Desk)", "USER_SWAP_ETH_USDT", slipBps, logLine);
      this.step();
      this.userReceipts.unshift({
        id: "swap-" + this.tick + "-" + this.userReceipts.length,
        tick: this.tick,
        venue: "REVM",
        side: "SWAP",
        orderType: "AMM x*y=k",
        priceFormatted: formatDollarsPips(effPrice),
        qtyFormatted: formatQtyPips(inPips) + " ETH -> " + formatQtyPips(usdtOutPips) + " USDT",
        status: "COMMITTED BLOCK #" + this.blockNumber,
        detail: "30bps CFMM pool fee applied; slippage " + slipBps + "bps."
      });
    } else {
      // USDT -> ETH
      const ethOutPips = Math.floor((this.reserveBasePips * feeNet) / (this.reserveQuotePips + feeNet));
      this.reserveQuotePips += inPips;
      this.reserveBasePips -= ethOutPips;
      user.cashQuotePips -= inPips;
      user.inventoryBasePips += ethOutPips;
      user.totalFills += 1;
      const effPrice = ethOutPips > 0 ? Math.floor((inPips / ethOutPips) * SCALE) : spotBefore;
      const slipBps = Math.abs(Math.floor(((effPrice - spotBefore) * 10000) / Math.max(1, spotBefore)));
      const logLine = "[BLK #" + this.blockNumber + "] " + hashPrefix + ".. [YOU] CALL swapExactTokens (" + formatQtyPips(inPips) + " USDT->" + formatQtyPips(ethOutPips) + " ETH)";
      this.pushEvmEvent(hashPrefix, "You (Live Desk)", "USER_SWAP_USDT_ETH", slipBps, logLine);
      this.step();
      this.userReceipts.unshift({
        id: "swap-" + this.tick + "-" + this.userReceipts.length,
        tick: this.tick,
        venue: "REVM",
        side: "SWAP",
        orderType: "AMM x*y=k",
        priceFormatted: formatDollarsPips(effPrice),
        qtyFormatted: formatQtyPips(inPips) + " USDT -> " + formatQtyPips(ethOutPips) + " ETH",
        status: "COMMITTED BLOCK #" + this.blockNumber,
        detail: "30bps CFMM pool fee applied; slippage " + slipBps + "bps."
      });
    }
    if (this.userReceipts.length > 20) this.userReceipts.length = 20;
  }

  captureArb(sizeEth) {
    // Atomic CLOB <-> Revm cross-venue arbitrage for [YOU]
    const user = this.agents["You (Live Desk)"];
    const qtyPips = Math.max(1000000, Math.round(Number(sizeEth) * SCALE));
    const spot = this.evmSpotPips();
    const halfSpreadPips = Math.floor((this.clobMidPips * this.spreadBps) / 20000);
    const bestBid = this.clobMidPips - halfSpreadPips;
    const bestAsk = this.clobMidPips + halfSpreadPips;
    this.swapNonce += 1;
    this.blockNumber += 1;
    const hashPrefix = "0x" + fnv256Hex(["USER_ARB", this.tick, this.swapNonce]).slice(0, 4);
    let pnlPips = 0;
    let route = "";
    let ammPx = spot;
    if (this.clobMidPips >= spot) {
      // AMM cheap: buy ETH on Revm with USDT, sell ETH into CLOB bid
      const usdtNeeded = Math.floor((this.reserveQuotePips * qtyPips) / Math.max(1, this.reserveBasePips - qtyPips));
      const usdtIn = Math.floor(usdtNeeded * 10000 / 9970);
      this.reserveQuotePips += usdtIn;
      this.reserveBasePips -= qtyPips;
      const proceeds = Math.floor((bestBid / SCALE) * qtyPips);
      const fee = Math.floor(proceeds * 4 / 10000);
      pnlPips = proceeds - fee - usdtIn;
      user.cashQuotePips += pnlPips;
      this.clobMidPips -= Math.floor((qtyPips / SCALE) * 4500000);
      ammPx = Math.floor((usdtIn / qtyPips) * SCALE);
      route = "BUY " + formatQtyPips(qtyPips) + " ETH on Revm @ " + formatDollarsPips(ammPx) + " -> SELL on CLOB @ " + formatDollarsPips(bestBid);
    } else {
      // AMM rich: buy ETH on CLOB ask, sell ETH into Revm pool
      const cost = Math.floor((bestAsk / SCALE) * qtyPips);
      const fee = Math.floor(cost * 4 / 10000);
      const feeNet = Math.floor(qtyPips * 9970 / 10000);
      const usdtOut = Math.floor((this.reserveQuotePips * feeNet) / (this.reserveBasePips + feeNet));
      this.reserveBasePips += qtyPips;
      this.reserveQuotePips -= usdtOut;
      pnlPips = usdtOut - cost - fee;
      user.cashQuotePips += pnlPips;
      this.clobMidPips += Math.floor((qtyPips / SCALE) * 4500000);
      ammPx = Math.floor((usdtOut / qtyPips) * SCALE);
      route = "BUY " + formatQtyPips(qtyPips) + " ETH on CLOB @ " + formatDollarsPips(bestAsk) + " -> SELL on Revm @ " + formatDollarsPips(ammPx);
    }
    user.totalFills += 2;
    const pnlUsd = (pnlPips / SCALE).toFixed(2);
    this.pushEvmEvent(hashPrefix, "You (Live Desk)", "ATOMIC_ARB", 0, "[BLK #" + this.blockNumber + "] " + hashPrefix + ".. [YOU] ATOMIC ARB " + route + " | PnL $" + pnlUsd);
    this.step();
    this.userReceipts.unshift({
      id: "arb-" + this.tick + "-" + this.userReceipts.length,
      tick: this.tick,
      venue: "REVM",
      side: "SWAP",
      orderType: "ATOMIC ARB",
      priceFormatted: formatDollarsPips(ammPx),
      qtyFormatted: formatQtyPips(qtyPips) + " ETH",
      status: pnlPips >= 0 ? "ARB CAPTURED" : "ARB NEGATIVE (FEES > BASIS)",
      detail: route + " | net PnL $" + pnlUsd + " after 30bps pool fee + 4bps taker fee."
    });
    if (this.userReceipts.length > 20) this.userReceipts.length = 20;
  }

  deployCustomAgent(config) {
    const id = (config.agentId || "Custom-Alpha-v1").trim();
    this.customAgentConfigs[id] = config;
    const initInv = config.archetype === "NEURO_LLM_MM" ? -25 * SCALE : 15 * SCALE;
    const initCash = 724000 * SCALE - Math.floor((initInv / SCALE) * this.clobMidPips);
    this.agents[id] = {
      agentId: id,
      badge: "[CUST]",
      status: "ACT",
      initialEquityPips: 724000 * SCALE,
      cashQuotePips: initCash,
      inventoryBasePips: initInv,
      peakEquityPips: 724000 * SCALE,
      maxDrawdownBps: 0,
      psrBps: 8650,
      calmarBps: 8100,
      oodSurvivalBps: 8800,
      totalFills: 1,
      spreadBps: Number(config.baseSpreadBps) || 10,
      maxDdLimitBps: Number(config.maxDrawdownLimitBps) || 1500,
      oodMult: Number(config.oodSpreadMultiplier) || 2.5,
      archetype: config.archetype || "NEURO_LLM_MM"
    };
    this.reasoningTraces.unshift({
      tick: this.tick,
      agentId: id,
      regime: REGIMES[this.regimeCode],
      thoughtSummary: "Deployed custom strategy (" + config.archetype + ") with base spread " + config.baseSpreadBps + "bps & OOD multiplier " + config.oodSpreadMultiplier + "x.",
      toolAction: "sdk.register_agent(id='" + id + "', spread_bps=" + config.baseSpreadBps + ")",
      targetSpreadBps: Number(config.baseSpreadBps) || 10
    });
    this.step();
  }

  step() {
    this.tick += 1;
    this.hawkesExcitationPips = Math.floor((this.hawkesExcitationPips * 94) / 100);

    const prevRegime = this.regimeCode;
    if (this.regimeLock > 0) {
      this.regimeLock -= 1;
    } else if (this.tick % 12 === 0) {
      const roll = this.randRange(0, 999);
      const row = TRANSITION_MATRIX[this.regimeCode];
      if (roll < row[0]) this.regimeCode = 0;
      else if (roll < row[0] + row[1]) this.regimeCode = 1;
      else if (roll < row[0] + row[1] + row[2]) this.regimeCode = 2;
      else this.regimeCode = 3;
    }

    const arrivalThreshold = [18, 48, 150, 380][this.regimeCode];
    if (this.randRange(0, 999) < arrivalThreshold) {
      this.hawkesExcitationPips += 35000000;
    }

    const pullPips = Math.floor((224150000000 - this.fundamentalPips) / 220);
    const volBps = [2, 4, 8, 16][this.regimeCode];
    const driftBps = [0, 1, -2, -6][this.regimeCode];
    const stepBps = driftBps + this.randRange(-volBps, volBps);

    this.fundamentalPips = Math.max(
      1400 * SCALE,
      Math.min(3400 * SCALE, Math.floor((this.fundamentalPips * (10000 + stepBps)) / 10000) + pullPips)
    );

    const clobPull = Math.floor((this.fundamentalPips - this.clobMidPips) * 45 / 100);
    this.clobMidPips += clobPull;

    // Check resting user limit orders
    if (this.restingUserOrders.length > 0) {
      const remaining = [];
      const user = this.agents["You (Live Desk)"];
      for (const ord of this.restingUserOrders) {
        if (ord.side === "BID" && this.clobMidPips <= ord.pricePips) {
          const notional = Math.floor((ord.pricePips / SCALE) * ord.qtyPips);
          user.inventoryBasePips += ord.qtyPips;
          user.cashQuotePips -= notional;
          user.totalFills += 1;
          this.userReceipts.unshift({
            id: "fill-" + this.tick + "-" + this.userReceipts.length,
            tick: this.tick,
            venue: "CLOB",
            side: "BID",
            orderType: "LIMIT (MAKER)",
            priceFormatted: formatDollarsPips(ord.pricePips),
            qtyFormatted: formatQtyPips(ord.qtyPips) + " ETH",
            status: "MAKER FILLED",
            detail: "Resting Bid filled as market traded through your limit level."
          });
        } else if (ord.side === "ASK" && this.clobMidPips >= ord.pricePips) {
          const notional = Math.floor((ord.pricePips / SCALE) * ord.qtyPips);
          user.inventoryBasePips -= ord.qtyPips;
          user.cashQuotePips += notional;
          user.totalFills += 1;
          this.userReceipts.unshift({
            id: "fill-" + this.tick + "-" + this.userReceipts.length,
            tick: this.tick,
            venue: "CLOB",
            side: "ASK",
            orderType: "LIMIT (MAKER)",
            priceFormatted: formatDollarsPips(ord.pricePips),
            qtyFormatted: formatQtyPips(ord.qtyPips) + " ETH",
            status: "MAKER FILLED",
            detail: "Resting Ask filled as market traded through your limit level."
          });
        } else {
          remaining.push(ord);
        }
      }
      this.restingUserOrders = remaining;
    }

    this.spreadBps = this.regimeCode === 3 ? this.randRange(26, 48)
      : this.regimeCode === 2 ? this.randRange(18, 28)
      : this.randRange(8, 15);

    this.imbalanceBps = this.regimeCode >= 2
      ? this.randRange(-780, -180)
      : this.randRange(-320, 420);

    // Cross-venue Revm AMM Swap activity
    if (this.tick % 4 === 0) {
      const evmSpot = this.evmSpotPips();
      const diffBps = Math.floor(((this.clobMidPips - evmSpot) * 10000) / Math.max(1, evmSpot));
      this.swapNonce += 1;
      if (this.swapNonce % 2 === 0) this.blockNumber += 1;

      const hashPrefix = "0x" + fnv256Hex([this.seed, this.tick, this.swapNonce]).slice(0, 4);
      if (diffBps < -8 || this.regimeCode === 3) {
        const ethInPips = this.randRange(350, 1450) * (SCALE / 100);
        const feeNet = Math.floor(ethInPips * 9970 / 10000);
        const usdtOutPips = Math.floor((this.reserveQuotePips * feeNet) / (this.reserveBasePips + feeNet));
        this.reserveBasePips += ethInPips;
        this.reserveQuotePips -= usdtOutPips;
        const slip = Math.max(4, Math.min(62, Math.abs(diffBps)));
        this.pushEvmEvent(
          hashPrefix,
          "Hawkes-HFT",
          "SWAP_ETH_USDT",
          slip,
          "[BLK #" + this.blockNumber + "] " + hashPrefix + ".. SWAP " + formatQtyPips(ethInPips) + " ETH->" + formatQtyPips(usdtOutPips) + " USDT"
        );
      } else {
        const usdtInPips = this.randRange(4500, 18000) * SCALE;
        const feeNet = Math.floor(usdtInPips * 9970 / 10000);
        const ethOutPips = Math.floor((this.reserveBasePips * feeNet) / (this.reserveQuotePips + feeNet));
        this.reserveQuotePips += usdtInPips;
        this.reserveBasePips -= ethOutPips;
        const slip = Math.max(3, Math.min(45, Math.abs(diffBps)));
        this.pushEvmEvent(
          hashPrefix,
          "DeepSeek-R1",
          "CALL_SWAP_EXACT",
          slip,
          "[BLK #" + this.blockNumber + "] " + hashPrefix + ".. CALL swapExactTokens (" + formatQtyPips(ethOutPips) + " ETH)"
        );
      }
    }

    if (prevRegime !== this.regimeCode && this.regimeCode >= 2) {
      const hashPrefix = "0x" + fnv256Hex([this.tick, "ORACLE"]).slice(0, 4);
      this.pushEvmEvent(
        hashPrefix,
        "0x01f..oracle",
        "ORACLE_UPDATE_LAG",
        24,
        "[BLK #" + this.blockNumber + "] " + hashPrefix + ".. ORACLE UPDATE LAG (" + REGIMES[this.regimeCode] + ")"
      );
    }

    // Update Agent Portfolios
    const gemini = this.agents["Gemini-2.5"];
    const deepseek = this.agents["DeepSeek-R1"];
    const hawkes = this.agents["Hawkes-HFT"];
    const mmAlpha = this.agents["MM-Alpha"];

    gemini.cashQuotePips += (this.regimeCode >= 2 ? 95 : 42) * SCALE;
    deepseek.cashQuotePips += (this.regimeCode >= 2 ? 68 : 36) * SCALE;
    hawkes.cashQuotePips += (this.regimeCode === 3 ? -35 : 22) * SCALE;
    if (mmAlpha.status === "ACT") {
      mmAlpha.cashQuotePips += (this.regimeCode >= 2 ? -240 : 12) * SCALE;
    }

    // Step any deployed custom agents
    for (const id of Object.keys(this.customAgentConfigs)) {
      const ag = this.agents[id];
      if (!ag || ag.status !== "ACT") continue;
      const isAdaptive = ag.oodMult >= 1.8;
      if (this.regimeCode >= 2) {
        ag.cashQuotePips += (isAdaptive ? 85 : -110) * SCALE;
        ag.spreadBps = Math.round((this.customAgentConfigs[id].baseSpreadBps || 10) * ag.oodMult);
      } else {
        ag.cashQuotePips += 48 * SCALE;
        ag.spreadBps = this.customAgentConfigs[id].baseSpreadBps || 10;
      }
      if (this.tick % 3 === 0) ag.totalFills += 1;
    }

    if (this.tick % 3 === 0) {
      gemini.totalFills += 1;
      deepseek.totalFills += 1;
      hawkes.totalFills += 2;
      if (mmAlpha.status === "ACT") mmAlpha.totalFills += 1;
    }

    for (const key of Object.keys(this.agents)) {
      const ag = this.agents[key];
      const eq = ag.cashQuotePips + Math.floor((ag.inventoryBasePips / SCALE) * this.clobMidPips);
      if (eq > ag.peakEquityPips) ag.peakEquityPips = eq;
      const ddBps = Math.max(0, Math.floor(((ag.peakEquityPips - eq) * 10000) / ag.peakEquityPips));
      if (ddBps > ag.maxDrawdownBps) ag.maxDrawdownBps = ddBps;

      if (ag.agentId === "MM-Alpha" && ag.status === "ACT" && ag.maxDrawdownBps >= 320) {
        ag.status = "LIQ";
        const hashPrefix = "0x90c4";
        this.pushEvmEvent(
          hashPrefix,
          "MM-Alpha",
          "LIQUIDATION_WARNING",
          ag.maxDrawdownBps,
          "[BLK #" + this.blockNumber + "] 0x90c4.. LIQUIDATION WARNING: MM-Alpha margin breached!"
        );
      }
    }

    if (this.tick % 25 === 0) {
      this.emitMacroReasoning();
    }
  }

  emitMacroReasoning() {
    const reg = REGIMES[this.regimeCode];
    const gSpread = this.regimeCode === 3 ? 38 : this.regimeCode === 2 ? 24 : 8;
    const dSpread = this.regimeCode === 3 ? 30 : this.regimeCode === 2 ? 20 : 10;
    this.agents["Gemini-2.5"].spreadBps = gSpread;
    this.agents["DeepSeek-R1"].spreadBps = dSpread;

    const gThought = this.regimeCode === 3
      ? "Flash Crash Hawkes cascade active! Widening bid-ask spread to 38bps & hedging inventory delta."
      : this.regimeCode === 2
      ? "Liquidity drought detected on L2 ladder; expanding spread to 24bps to prevent toxic adverse selection."
      : "Order flow balanced around " + formatDollarsPips(this.clobMidPips) + "; quoting tight 8bps two-sided market.";

    const dThought = this.regimeCode >= 2
      ? "Cross-venue CLOB/Revm basis widened under OOD stress; routing defensive CFMM swap via 0x00..a9e8."
      : "Capturing statistical arbitrage between CLOB mid and Revm x*y=k pool (30bps fee tier).";

    this.reasoningTraces.unshift(
      {
        tick: this.tick,
        agentId: "Gemini-2.5",
        regime: reg,
        thoughtSummary: gThought,
        toolAction: "mcp.set_mm_params(spread_bps=" + gSpread + ", skew_bps=" + (this.regimeCode >= 2 ? -24 : 0) + ")",
        targetSpreadBps: gSpread
      },
      {
        tick: this.tick,
        agentId: "DeepSeek-R1",
        regime: reg,
        thoughtSummary: dThought,
        toolAction: "mcp.execute_evm_swap(zero_for_one=" + (this.regimeCode >= 2) + ", amount=2.40)",
        targetSpreadBps: dSpread
      }
    );
    if (this.reasoningTraces.length > 14) {
      this.reasoningTraces.length = 14;
    }
  }

  pushEvmEvent(txHash, caller, action, slippageBps, logLine) {
    this.evmEvents.unshift({
      id: this.blockNumber + "-" + this.swapNonce + "-" + txHash + "-" + this.tick,
      blockNumber: this.blockNumber,
      txHash: txHash,
      caller: caller,
      action: action,
      slippageBps: slippageBps,
      logLine: logLine
    });
    if (this.evmEvents.length > 28) {
      this.evmEvents.length = 28;
    }
  }

  stateHash() {
    return fnv256Hex([
      this.seed,
      this.tick,
      this.blockNumber,
      this.regimeCode,
      this.clobMidPips,
      this.reserveBasePips,
      this.reserveQuotePips,
      this.agents["Gemini-2.5"].cashQuotePips,
      this.agents["DeepSeek-R1"].cashQuotePips,
      this.agents["Hawkes-HFT"].cashQuotePips,
      this.agents["MM-Alpha"].cashQuotePips,
      this.agents["MM-Alpha"].status
    ]);
  }

  buildFrame(isShared) {
    const bids = [];
    const asks = [];
    const halfSpreadPips = Math.floor((this.clobMidPips * this.spreadBps) / 20000);
    let cumAskEth = 0;
    let cumBidEth = 0;

    for (let i = 0; i < 5; i++) {
      const stepPips = (i * 45 + 15) * (SCALE / 100);
      const askPrice = this.clobMidPips + halfSpreadPips + stepPips;
      const bidPrice = this.clobMidPips - halfSpreadPips - stepPips;
      const askQty = ((i + 1) * 260 + ((this.tick + i * 37) % 580)) * (SCALE / 100);
      const bidQty = ((i + 1) * 290 + ((this.tick + i * 53) % 640)) * (SCALE / 100);

      const askEth = Number((askQty / SCALE).toFixed(2));
      const bidEth = Number((bidQty / SCALE).toFixed(2));
      cumAskEth = Number((cumAskEth + askEth).toFixed(2));
      cumBidEth = Number((cumBidEth + bidEth).toFixed(2));

      asks.push({
        pricePips: askPrice,
        priceUsd: Number((askPrice / SCALE).toFixed(2)),
        priceFormatted: formatDollarsPips(askPrice),
        qtyPips: askQty,
        qtyEth: askEth,
        qtyFormatted: formatQtyPips(askQty),
        cumulativeEth: cumAskEth,
        orderCount: (i % 3) + 1
      });
      bids.push({
        pricePips: bidPrice,
        priceUsd: Number((bidPrice / SCALE).toFixed(2)),
        priceFormatted: formatDollarsPips(bidPrice),
        qtyPips: bidQty,
        qtyEth: bidEth,
        qtyFormatted: formatQtyPips(bidQty),
        cumulativeEth: cumBidEth,
        orderCount: ((i + 1) % 4) + 1
      });
    }

    const leaderboard = Object.values(this.agents).map(ag => {
      const eq = ag.cashQuotePips + Math.floor((ag.inventoryBasePips / SCALE) * this.clobMidPips);
      const pnlBps = Math.floor(((eq - ag.initialEquityPips) * 10000) / ag.initialEquityPips);
      const psrBps = Math.max(500, Math.min(9950, ag.psrBps + pnlBps * 2));
      const calmarBps = Math.max(400, Math.min(9900, ag.calmarBps + pnlBps * 3));
      const oodBps = ag.status === "LIQ" ? 0 : Math.max(800, Math.min(9900, ag.oodSurvivalBps - ag.maxDrawdownBps * 2));
      const acsScoreBps = ag.status === "LIQ"
        ? 0
        : Math.max(0, Math.min(10000, Math.floor((40 * psrBps + 30 * calmarBps + 20 * oodBps - 10 * 250) / 100)));

      return {
        agentId: ag.agentId,
        badge: ag.badge,
        status: ag.status,
        equityPips: eq,
        equityUsd: Math.round(eq / SCALE),
        equityFormatted: "$" + Math.floor(eq / SCALE).toLocaleString("en-US"),
        cashUsd: Math.round(ag.cashQuotePips / SCALE),
        inventoryEth: Number((ag.inventoryBasePips / SCALE).toFixed(2)),
        pnlBps: pnlBps,
        maxDrawdownBps: ag.maxDrawdownBps,
        psrBps: psrBps,
        calmarBps: calmarBps,
        oodSurvivalBps: oodBps,
        acsScoreBps: acsScoreBps,
        totalFills: ag.totalFills,
        activeSpreadBps: ag.spreadBps || 8
      };
    }).sort((a, b) => b.acsScoreBps - a.acsScoreBps || b.equityPips - a.equityPips);

    const evmSpot = this.evmSpotPips();
    const basisBps = Math.round(((this.clobMidPips - evmSpot) * 10000) / Math.max(1, evmSpot));
    const regLabel = REGIMES[this.regimeCode];
    const hawkesTotal = 20000000 + this.hawkesExcitationPips;

    const headlines = {
      "CALM": "[WIRE] Institutional order flow balanced; L2 spreads anchored near 8-15 bps.",
      "TRENDING": "[WIRE] Directional macro momentum across CLOB & Revm CFMM pools.",
      "LIQUIDITY DROUGHT": "[HAZARD] L2 depth thinning; Hawkes intensity rising — makers widening quotes.",
      "FLASH CRASH": "[ALERT] FLASH CRASH CASCADE: Emergency rate shock & DeFi collateral liquidation wave!"
    };

    const getEqUsd = (id) => {
      const ag = this.agents[id];
      if (!ag) return 724000;
      return Math.round((ag.cashQuotePips + Math.floor((ag.inventoryBasePips / SCALE) * this.clobMidPips)) / SCALE);
    };

    const baseEth = Math.floor(this.reserveBasePips / SCALE);
    const quoteUsdt = Math.floor(this.reserveQuotePips / SCALE);
    const kMillions = ((baseEth * quoteUsdt) / 1e9).toFixed(3) + "B";

    return {
      tick: this.tick,
      blockNumber: this.blockNumber,
      clobMidPips: this.clobMidPips,
      clobMidUsd: Number((this.clobMidPips / SCALE).toFixed(2)),
      clobMidFormatted: formatDollarsPips(this.clobMidPips),
      evmSpotPips: evmSpot,
      evmSpotUsd: Number((evmSpot / SCALE).toFixed(2)),
      evmSpotFormatted: formatDollarsPips(evmSpot),
      basisBps: basisBps,
      spreadBps: this.spreadBps,
      imbalanceBps: this.imbalanceBps,
      regime: regLabel,
      hawkesIntensityPips: hawkesTotal,
      newsHeadline: headlines[regLabel],
      stateHash: this.stateHash(),
      evmReserveBaseEth: baseEth,
      evmReserveQuoteUsdt: quoteUsdt,
      evmInvariantK: kMillions,
      bids: bids,
      asks: asks,
      evmEvents: this.evmEvents.slice(0, 16),
      reasoningTraces: this.reasoningTraces.slice(0, 6),
      leaderboard: leaderboard,
      userReceipts: this.userReceipts.slice(0, 12),
      latestPoint: {
        tick: this.tick,
        timeSec: 1700000000 + this.tick,
        clobMidUsd: Number((this.clobMidPips / SCALE).toFixed(2)),
        evmSpotUsd: Number((evmSpot / SCALE).toFixed(2)),
        regime: regLabel,
        geminiEquityUsd: getEqUsd("Gemini-2.5"),
        deepseekEquityUsd: getEqUsd("DeepSeek-R1"),
        hawkesEquityUsd: getEqUsd("Hawkes-HFT"),
        mmAlphaEquityUsd: getEqUsd("MM-Alpha"),
        userEquityUsd: getEqUsd("You (Live Desk)"),
        basisBps: basisBps,
        spreadBps: this.spreadBps,
        hawkesIntensity: Number((hawkesTotal / SCALE).toFixed(4)),
        agentEquities: Object.keys(this.agents).reduce((acc, id) => { acc[id] = getEqUsd(id); return acc; }, {})
      },
      sharedBufferActive: isShared
    };
  }
}

let kernel = new DeterministicKernel(42);
let floatView = null;
let isSharedBuffer = false;
let paused = false;
let ticksPerFrame = 1;

function writeToSharedBuffer(frame) {
  if (!floatView) return;
  floatView[0] = frame.tick;
  floatView[1] = frame.blockNumber;
  floatView[2] = frame.clobMidPips;
  floatView[3] = frame.evmSpotPips;
  floatView[4] = frame.spreadBps;
  floatView[5] = frame.imbalanceBps;
  floatView[6] = REGIMES.indexOf(frame.regime);
  floatView[7] = frame.hawkesIntensityPips;
}

const BENCH_STAGES = [
  { key: "calm", name: "Calm baseline", inject: null },
  { key: "toxic", name: "MEV toxic flow", inject: "toxic-flow" },
  { key: "whale", name: "450 ETH AMM whale shock", inject: "whale-dump" },
  { key: "crash", name: "350 bps flash cascade", inject: "flash-crash" }
];

function runBenchmark(seed, ticksPerStage) {
  const k = new DeterministicKernel(seed);
  // carry deployed custom agents into the tournament
  Object.keys(kernel.customAgentConfigs || {}).forEach(id => k.deployCustomAgent(kernel.customAgentConfigs[id]));
  const ids = Object.keys(k.agents);
  const series = {};
  ids.forEach(id => { series[id] = []; });
  const stages = [];
  const totalTicks = ticksPerStage * BENCH_STAGES.length;
  let done = 0;
  for (let s = 0; s < BENCH_STAGES.length; s++) {
    const st = BENCH_STAGES[s];
    if (st.inject) k.injectScenario(st.inject);
    for (let t = 0; t < ticksPerStage; t++) {
      k.step();
      done++;
      const f = k.buildFrame(false);
      f.leaderboard.forEach(e => { if (series[e.agentId]) series[e.agentId].push(e.equityUsd); });
      if (done % 40 === 0) {
        self.postMessage({ type: "BENCHMARK_PROGRESS", stageIndex: s, stageCount: BENCH_STAGES.length, stageName: st.name, progress: done / totalTicks });
      }
    }
    const f = k.buildFrame(false);
    stages.push({ key: st.key, name: st.name, endTick: k.tick, regime: f.regime, clobMidUsd: f.clobMidUsd, evmSpotUsd: f.evmSpotUsd, basisBps: f.basisBps, hawkesIntensity: Number((f.hawkesIntensityPips / SCALE).toFixed(4)), leaderboard: f.leaderboard });
  }
  const final = k.buildFrame(false);
  const agents = final.leaderboard.map(e => {
    const eqs = series[e.agentId] || [];
    let peak = eqs.length ? eqs[0] : e.equityUsd;
    let mdd = 0;
    let ups = 0;
    let moves = 0;
    for (let i = 0; i < eqs.length; i++) {
      if (eqs[i] > peak) peak = eqs[i];
      const dd = peak > 0 ? (peak - eqs[i]) / peak : 0;
      if (dd > mdd) mdd = dd;
      if (i > 0 && eqs[i] !== eqs[i - 1]) { moves++; if (eqs[i] > eqs[i - 1]) ups++; }
    }
    const stride = Math.max(1, Math.floor(eqs.length / 120));
    const curve = eqs.filter((_, i) => i % stride === 0);
    return Object.assign({}, e, { maxDrawdownPct: Number((mdd * 100).toFixed(3)), winRatePct: moves ? Number(((ups / moves) * 100).toFixed(1)) : 0, equityCurve: curve });
  });
  self.postMessage({ type: "BENCHMARK_PROGRESS", stageIndex: BENCH_STAGES.length - 1, stageCount: BENCH_STAGES.length, stageName: "Complete", progress: 1 });
  self.postMessage({ type: "BENCHMARK_RESULT", result: { seed: seed, ticksPerStage: ticksPerStage, totalTicks: k.tick, stateHash: k.stateHash(), stages: stages, agents: agents } });
}

self.onmessage = function(ev) {
  const msg = ev.data;
  if (!msg || !msg.type) return;

  if (msg.type === "INIT") {
    isSharedBuffer = Boolean(msg.isShared);
    if (msg.buffer) {
      floatView = new Float64Array(msg.buffer);
    }
    kernel = new DeterministicKernel(msg.seed || 42);
    const warmupHistory = [];
    for (let i = 0; i < 80; i++) {
      if (i === 45) {
        kernel.triggerFlashCrash();
      } else {
        kernel.step();
      }
      const f = kernel.buildFrame(isSharedBuffer);
      warmupHistory.push(f.latestPoint);
    }
    const frame = warmupHistory.length > 0 ? kernel.buildFrame(isSharedBuffer) : kernel.buildFrame(isSharedBuffer);
    writeToSharedBuffer(frame);
    self.postMessage({ type: "FRAME", frame: frame, history: warmupHistory });
  } else if (msg.type === "SET_PAUSED") {
    paused = Boolean(msg.paused);
  } else if (msg.type === "SET_SPEED") {
    ticksPerFrame = Math.max(1, Math.min(25, Number(msg.ticksPerFrame) || 1));
  } else if (msg.type === "STEP_ONCE") {
    const n = Math.max(1, Number(msg.ticks) || 1);
    for (let i = 0; i < n; i++) kernel.step();
    const frame = kernel.buildFrame(isSharedBuffer);
    writeToSharedBuffer(frame);
    self.postMessage({ type: "FRAME", frame: frame });
  } else if (msg.type === "TRIGGER_FLASH_CRASH") {
    kernel.triggerFlashCrash();
    const frame = kernel.buildFrame(isSharedBuffer);
    writeToSharedBuffer(frame);
    self.postMessage({ type: "FRAME", frame: frame });
  } else if (msg.type === "INJECT_SCENARIO") {
    kernel.injectScenario(msg.scenario);
    const frame = kernel.buildFrame(isSharedBuffer);
    writeToSharedBuffer(frame);
    self.postMessage({ type: "FRAME", frame: frame });
  } else if (msg.type === "SET_REGIME") {
    kernel.setRegime(msg.regime);
    const frame = kernel.buildFrame(isSharedBuffer);
    writeToSharedBuffer(frame);
    self.postMessage({ type: "FRAME", frame: frame });
  } else if (msg.type === "SUBMIT_USER_ORDER") {
    kernel.submitUserOrder(msg.side, msg.orderType, msg.priceUsd, msg.qtyEth);
    const frame = kernel.buildFrame(isSharedBuffer);
    writeToSharedBuffer(frame);
    self.postMessage({ type: "FRAME", frame: frame });
  } else if (msg.type === "EXECUTE_USER_SWAP") {
    kernel.executeUserSwap(msg.zeroForOne, msg.amountIn);
    const frame = kernel.buildFrame(isSharedBuffer);
    writeToSharedBuffer(frame);
    self.postMessage({ type: "FRAME", frame: frame });
  } else if (msg.type === "DEPLOY_CUSTOM_AGENT") {
    kernel.deployCustomAgent(msg.config);
    const frame = kernel.buildFrame(isSharedBuffer);
    writeToSharedBuffer(frame);
    self.postMessage({ type: "FRAME", frame: frame });
  } else if (msg.type === "RESET") {
    kernel.reset(msg.seed || 42);
    const warmupHistory = [];
    for (let i = 0; i < 60; i++) {
      kernel.step();
      warmupHistory.push(kernel.buildFrame(isSharedBuffer).latestPoint);
    }
    const frame = kernel.buildFrame(isSharedBuffer);
    writeToSharedBuffer(frame);
    self.postMessage({ type: "FRAME", frame: frame, history: warmupHistory });
  } else if (msg.type === "CAPTURE_ARB") {
    kernel.captureArb(msg.sizeEth);
    const frame = kernel.buildFrame(isSharedBuffer);
    writeToSharedBuffer(frame);
    self.postMessage({ type: "FRAME", frame: frame });
  } else if (msg.type === "RUN_BENCHMARK") {
    runBenchmark(msg.seed || 42, Math.max(50, Math.min(1000, msg.ticksPerStage || 200)));
  } else if (msg.type === "VERIFY_5RUN_SHA256") {
    const hashes = [];
    const testSeed = msg.seed || 42;
    const testTicks = msg.ticks || 250;
    for (let r = 0; r < 5; r++) {
      const k = new DeterministicKernel(testSeed);
      for (let t = 1; t <= testTicks; t++) {
        if (t === Math.floor(testTicks / 2)) k.triggerFlashCrash();
        else k.step();
      }
      hashes.push(k.stateHash());
    }
    const allEqual = hashes.every(h => h === hashes[0]);
    self.postMessage({
      type: "DETERMINISM_RESULT",
      seed: testSeed,
      ticks: testTicks,
      runs: 5,
      allEqual: allEqual,
      hashes: hashes
    });
  }
};

setInterval(function() {
  if (paused) return;
  for (let i = 0; i < ticksPerFrame; i++) {
    kernel.step();
  }
  const frame = kernel.buildFrame(isSharedBuffer);
  writeToSharedBuffer(frame);
  self.postMessage({ type: "FRAME", frame: frame });
}, 110);
`;

export function createArenaWorker(): Worker {
  const blob = new Blob([WORKER_SOURCE], { type: "application/javascript" });
  const url = URL.createObjectURL(blob);
  return new Worker(url);
}
