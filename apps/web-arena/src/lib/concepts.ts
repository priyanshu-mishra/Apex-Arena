import type { ArenaTelemetryFrame } from "./sharedBuffer";

/**
 * Concept registry — every piece of jargon in the UI resolves to a plain-English
 * definition, its exact formula, and a sentence interpreting the live value.
 */
export interface Concept {
  title: string;
  formula: string;
  body: string;
  live?: (f: ArenaTelemetryFrame) => string;
}

const usd = (n: number) => "$" + Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const CONCEPTS = {
  basis: {
    title: "Cross-venue basis",
    formula: "basis_bps = (CLOB_mid − Revm_spot) / Revm_spot × 10,000",
    body: "How far the order-book price sits above or below the on-chain AMM price. When the gap exceeds the round-trip fees (~34 bps: 30 bps pool fee + 4 bps taker fee), buying on the cheap venue and selling on the rich one locks in a profit.",
    live: (f) => {
      const gap = f.clobMidUsd - f.evmSpotUsd;
      if (Math.abs(f.basisBps) < 3) return `Basis is ${f.basisBps} bps — the two venues agree to within ${usd(gap)}. No arbitrage worth the fees.`;
      return gap > 0
        ? `Basis is +${f.basisBps} bps: the CLOB trades ${usd(gap)} above Revm. Buying ETH on the AMM and selling into CLOB bids captures the gap.`
        : `Basis is ${f.basisBps} bps: Revm trades ${usd(gap)} above the CLOB. Buying on the CLOB and selling into the AMM captures the gap.`;
    },
  },
  hawkes: {
    title: "Hawkes intensity λ(t)",
    formula: "λ(t) = μ + Σ α·e^(−β(t − tᵢ))",
    body: "A self-exciting event rate: every shock raises the probability of the next one, then decays. It is how real markets cluster volatility — one liquidation triggers the next.",
    live: (f) => {
      const l = f.hawkesIntensityPips / 1e8;
      return l > 1.5
        ? `λ(t) = ${l.toFixed(3)} — heavily excited. Shocks are cascading; expect wide spreads and liquidations.`
        : l > 0.6
        ? `λ(t) = ${l.toFixed(3)} — elevated. The market is still digesting a recent shock.`
        : `λ(t) = ${l.toFixed(3)} — near its baseline μ = 0.2. Event arrivals are calm.`;
    },
  },
  invariantK: {
    title: "Constant-product invariant k",
    formula: "x · y = k   (x = ETH reserve, y = USDT reserve)",
    body: "The Revm pool always keeps the product of its reserves constant (before the 30 bps fee). Spot price is y / x, so every swap moves the price along a hyperbola — bigger trades pay more slippage.",
    live: (f) => `Reserves: ${f.evmReserveBaseEth.toLocaleString()} ETH × ${f.evmReserveQuoteUsdt.toLocaleString()} USDT ≈ k of ${f.evmInvariantK}. Spot = y/x = ${f.evmSpotFormatted}.`,
  },
  spread: {
    title: "Bid-ask spread",
    formula: "spread_bps = (best_ask − best_bid) / mid × 10,000",
    body: "The cost of crossing the book immediately. Market makers widen it when they fear informed (toxic) flow or high volatility.",
    live: (f) => `Spread is ${f.spreadBps} bps (~${usd((f.clobMidUsd * f.spreadBps) / 10000)} per ETH).`,
  },
  imbalance: {
    title: "Order-book imbalance",
    formula: "imbalance = (bid_depth − ask_depth) / (bid_depth + ask_depth)",
    body: "Positive means more resting buy interest than sell interest near the top of the book — a short-horizon predictor of upward pressure.",
    live: (f) => `Imbalance is ${(f.imbalanceBps / 100).toFixed(1)}% — ${f.imbalanceBps >= 0 ? "buyers" : "sellers"} dominate near the touch.`,
  },
  psr: {
    title: "Probabilistic Sharpe Ratio — PSR(0)",
    formula: "PSR(0) = Φ( SR·√(n−1) / √(1 − γ₃·SR + (γ₄−1)/4·SR²) )",
    body: "The probability that the agent's true Sharpe ratio is above zero, after correcting for track length, skew (γ₃) and fat tails (γ₄). It punishes lucky short streaks that raw PnL rewards.",
  },
  calmar: {
    title: "Calmar ratio (capped)",
    formula: "Calmar = annualised return / |max drawdown|, clipped to [0, 1]",
    body: "Return earned per unit of worst peak-to-trough loss. It rewards agents that make money without deep drawdowns.",
  },
  ood: {
    title: "Out-of-distribution survival",
    formula: "Survival_OOD = share of stress regimes survived × (1 − drawdown penalty)",
    body: "How well the agent holds up in regimes it was not tuned for — flash crashes, toxic flow, whale shocks. Liquidated agents score 0.",
  },
  acs: {
    title: "Apex Composite Score (ACS)",
    formula: "ACS = 0.40·PSR(0) + 0.30·Calmar + 0.20·Survival_OOD − 0.10·Penalty_turnover",
    body: "The single benchmark number. It blends statistical confidence, drawdown efficiency and stress survival, and subtracts a penalty for churning. Breaching the 5% maintenance margin sets ACS to 0.",
  },
  margin: {
    title: "Maintenance margin",
    formula: "equity / initial_equity ≥ 5% (else immediate liquidation)",
    body: "If an account's equity falls through the 5% maintenance threshold it is force-liquidated and disqualified with ACS = 0. Leverage that looks clever in calm markets dies here.",
  },
  stp: {
    title: "Self-trade prevention (Cancel-Newest)",
    formula: "if incoming.owner == resting.owner → cancel incoming",
    body: "An agent can never trade against itself. The newest order is cancelled, preventing wash trades that would fake volume.",
  },
  ioc: {
    title: "Immediate-or-cancel (IOC)",
    formula: "fill what crosses now; cancel the remainder",
    body: "IOC never rests on the book. Use it when you want liquidity only at the current price.",
  },
  postOnly: {
    title: "Post-only",
    formula: "reject if order would cross the opposite best quote",
    body: "Guarantees you add liquidity as a maker (and never pay the taker fee). If the price would trade immediately, the order is rejected.",
  },
  fixedPoint: {
    title: "Fixed-point arithmetic",
    formula: "FixedPrice(i64), SCALE = 10⁸ pips = 1.0",
    body: "The Rust engine never uses floats for prices or balances. Every value is an integer number of pips, and intermediate products use i128 — so results are bit-for-bit identical on every machine.",
  },
  macroDigest: {
    title: "MacroDigest",
    formula: "every 100 fast ticks (1,000 ms virtual time)",
    body: "A frozen, deterministic snapshot of the market that reasoning agents receive at each macro epoch. Agents see exactly the same digest on every replay, so LLM latency can never leak wall-clock advantage.",
  },
  determinism: {
    title: "5-run SHA-256 determinism",
    formula: "hash(run₁) = hash(run₂) = … = hash(run₅)",
    body: "The native Rust kernel hashes its full state with SHA-256 after a seeded run. Five independent runs must produce the identical digest — proof that the benchmark is reproducible. (The in-browser JS port checks the same property with its own 256-bit FNV-1a digest.)",
  },
} satisfies Record<string, Concept>;

export type ConceptKey = keyof typeof CONCEPTS;
