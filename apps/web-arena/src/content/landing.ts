/**
 * Landing copy, verbatim from docs/design/landing/DESIGN_GUIDE.md §6.
 *
 * Precise lines use `*…*` to mark the emphasised (bone) spans the prototype
 * sets in <em>, and `_{…}` / `^{…}` for its <sub> / <sup> (the guide writes
 * these as `(…)`); strip the markers and the text is the guide's wording.
 * Title lines are the `.ln` mask-reveal lines; joined with a space they are
 * the guide's title.
 */

export type ChapterId = "c0" | "c1" | "c2" | "c3" | "c4" | "c5" | "c6" | "c7" | "c8" | "c9";

type ChapterBase<Id extends ChapterId> = {
  id: Id;
  /** Chapter rail label ("" for the close, which has no rail tick). */
  rail: string;
  title: string;
  titleLines: readonly string[];
  lede: string;
  /** Precise-mode line ("" where the chapter has none). */
  precise: string;
};

export type ReadoutCopy = { k: string; s: string };

export type StackLayer = { word: string; lang: string; plain: string; precise: string };

export const TOP_BAR = {
  wordmark: "ApexArena",
  plain: "Plain",
  precise: "Precise",
  cta: "Enter the arena",
  depthLabel: "Level of detail",
} as const;

export const STATUS = {
  seed: "seed",
  tick: "tick",
  eth: "ETH",
  spread: "spread",
  bps: "bps",
  lambda: "λ",
  note: "simulated in your browser",
} as const;

const c0 = {
  id: "c0",
  rail: "00 The market",
  title: "A market that fights back.",
  titleLines: ["A market that", "fights back."],
  lede: "ApexArena tests AI trading agents in a live simulated market. It reacts to every order, crashes on cue, and replays exactly.",
  precise:
    "Rust fixed-point *L3 order book* + embedded *revm x·y=k* pool + *Markov-switching Hawkes* regimes · 10 ms / 1 s dual-speed barrier · seed 42 → *5/5 identical SHA-256*",
  enter: "Enter the arena",
  crash: "Crash the market",
} as const satisfies ChapterBase<"c0"> & Record<string, unknown>;

const c1 = {
  id: "c1",
  rail: "01 Impact",
  title: "A replay can't feel your order.",
  titleLines: ["A replay can't", "feel your order."],
  lede: "Most trading AIs are graded on recorded prices, where even a huge order changes nothing. Here it eats through the sell orders and the price moves.",
  precise:
    "Orders walk *price-time FIFO* levels in *apex-clob* (LIMIT, MARKET, POST_ONLY, IOC, cancel-newest STP). Prices and sizes are *i64 fixed-point*, SCALE = 10⁸. No floats.",
  control: { label: "Your buy order", unit: "ETH", send: "Send it", note: "Sell-side ladder from the Rust engine: seed 42, tick 300." },
  readouts: {
    replay: { k: "In a replay", s: "price never notices" },
    arena: { k: "In ApexArena", s: "of 7 price levels cleared" },
    fill: { k: "Average fill", s: "last price" },
  },
} as const satisfies ChapterBase<"c1"> & Record<string, unknown>;

const c2 = {
  id: "c2",
  rail: "02 Two venues",
  title: "Two venues. One coin.",
  titleLines: ["Two venues.", "One coin."],
  lede: "An exchange-style order book and an on-chain pool both price the same ETH. When they drift apart, agents race to close the gap.",
  precise:
    "Pool: constant product *x · y = k*, 30 bps fee, executed in an in-memory *revm 19.4* EVM (*apex-evm*). Atomic CLOB ↔ AMM arbitrage pays once the gap clears the fee.",
  readouts: {
    clob: { k: "Order book", s: "price-time queue" },
    pool: { k: "On-chain pool", s: "priced by formula" },
    gap: { k: "Gap", s: "inside the fee: no trade", sOpen: "wider than the fee: agents trade it" },
  },
  caption: "Live values are simulated in your browser.",
} as const satisfies ChapterBase<"c2"> & Record<string, unknown>;

const c3 = {
  id: "c3",
  rail: "03 Chaos",
  title: "Shocks breed shocks.",
  titleLines: ["Shocks breed", "shocks."],
  lede: "The market has four moods. Trigger one and watch it spread down the canyon, the way real panics feed on themselves.",
  precise:
    "Self-exciting intensity *λ(t) = μ + Σ α·e^{−β(t−tᵢ)}* under a Markov-switching regime chain: *Calm, ToxicFlow, FlashCrash* (350 bps liquidity evaporation), *EvmShock* (450 ETH whale swap).",
  moods: [
    { mood: "calm", name: "Calm", sub: "Orderly quotes" },
    { mood: "toxic", name: "Toxic flow", sub: "Informed bursts" },
    { mood: "whale", name: "Whale dump", sub: "450 ETH into the pool" },
    { mood: "crash", name: "Flash crash", sub: "Liquidity vanishes" },
  ],
  readout: { k: "Shock intensity", s: "λ, events per tick" },
  groupLabel: "Trigger a market mood",
  traceLabel: "Live shock intensity over the last 20 seconds",
} as const satisfies ChapterBase<"c3"> & Record<string, unknown>;

const c4 = {
  id: "c4",
  rail: "04 The barrier",
  title: "Every second, the market holds still.",
  titleLines: ["Every second, the market holds still."],
  lede: "Fast bots act every tick. Thinking models answer once a second, while the clock is stopped, so no one gets to see the future.",
  precise:
    "Fast loop *Δt = 10 ms* · macro epoch *ΔT = 1 s = 100 ticks* · every reasoning agent receives the same *MacroDigest* in virtual time; no wall clock anywhere in the kernel.",
  clock: { fast: "fast clock", of: "/ 100 ticks", held: "market held · thinking agents answer", each: "10 ms each" },
} as const satisfies ChapterBase<"c4"> & Record<string, unknown>;

const c5 = {
  id: "c5",
  rail: "05 Score",
  title: "Profit isn't the score. Survival is.",
  titleLines: ["Profit isn't", "the score.", "Survival is."],
  lede: "Agents are graded on steady, risk-adjusted results. Lose past the margin limit and the score is zero, whatever came before.",
  precise:
    "*ACS = 0.40·PSR(0) + 0.30·Calmar_{capped} + 0.20·Survival_{OOD} − 0.10·Penalty_{turnover}* · 5% maintenance-margin breach → liquidated, ACS = 0",
  head: { agent: "Agent", profit: "Profit", drop: "Worst drop", psr: "PSR", calmar: "Calmar", survival: "Survival", acs: "Apex score" },
  weights: [
    { pct: "40%", label: "Confidence it wasn't luck" },
    { pct: "30%", label: "Drawdown control" },
    { pct: "20%", label: "Stress survival" },
    { pct: "−10%", label: "Churn" },
  ],
  caption: "Real engine output: flash-crash scenario, seed 42, 300 ticks. Agents are the arena's built-in entrants.",
  tableCaption: "Leaderboard from the Rust engine, flash-crash scenario, seed 42, 300 ticks",
} as const satisfies ChapterBase<"c5"> & Record<string, unknown>;

const c6 = {
  id: "c6",
  rail: "06 Proof",
  title: "Five runs. One market.",
  titleLines: ["Five runs.", "One market."],
  lede: "Start from the same seed and the whole market replays, down to the last bit. Any result can be re-run and checked by anyone.",
  precise:
    "*SHA-256* of the full kernel state after 300 ticks, seed 42: a calm market hit by a flash crash at tick 150 (a separate run from the score table). Output of *apex-tui --verify-determinism --seed 42 --ticks 300*; gate: *./scripts/verify_determinism_hook.sh*. No floats, no hash maps, no wall clock.",
  run: "run",
  match: "match",
  verdict: "/ 5 identical",
  verify: "Verify it yourself in the app",
  verifyHref: "/app/proof",
  rowsLabel: "Five runs with seed 42 produce the same SHA-256 state hash",
} as const satisfies ChapterBase<"c6"> & Record<string, unknown>;

const c7 = {
  id: "c7",
  rail: "07 Stack",
  title: "Built end to end.",
  titleLines: ["Built end to end."],
  lede: "",
  precise: "",
  layers: [
    {
      word: "Engine",
      lang: "Rust",
      plain: "The order book, the agents and the scoring. Whole-number maths only, so results never drift.",
      precise:
        "*apex-types · apex-clob · apex-kernel* · FixedPrice(i64) / FixedQty(i64), i128 intermediates · BTreeMap state · ChaCha8 RNG",
    },
    {
      word: "Pool",
      lang: "Rust + EVM",
      plain: "A real Ethereum virtual machine, embedded in the engine, running the on-chain market.",
      precise: "*apex-evm* · Bluealloy revm 19.4 + alloy-primitives · x·y=k, 30 bps",
    },
    {
      word: "Agents",
      lang: "Python",
      plain: "A Python SDK and a tool server, so any AI model can read the market and trade in it.",
      precise:
        "*apex-py* (PyO3) · MCP JSON-RPC 2.0, 7 tools: get_market_digest, get_orderbook_l2, submit_clob_order, execute_evm_swap, trigger_chaos_regime, get_leaderboard, verify_determinism",
    },
    {
      word: "Workstation",
      lang: "TypeScript",
      plain: "The live app: trade by hand, inject chaos, read each agent's reasoning, verify the proof.",
      precise:
        "*apps/web-arena* · Next.js 15, React 19 · in-browser kernel port in a WebWorker (its digest is FNV-1a; only the Rust kernel is SHA-256)",
    },
  ],
} as const satisfies ChapterBase<"c7"> & Record<string, unknown>;

/**
 * The LinkedIn profile URL. The link renders only when this is non-empty;
 * paste the real profile URL here to show it (nothing else changes).
 */
export const LINKEDIN_URL: string = "";

const c8 = {
  id: "c8",
  rail: "08 Credit",
  /** One statement at display scale (no small label above the name). */
  title: "Built by Priyanshu Mishra.",
  titleLines: ["Built by", "Priyanshu Mishra."],
  lede: "Rust, Python and TypeScript, end to end.",
  precise: "",
  github: { label: "GitHub", href: "https://github.com/priyanshu-mishra" },
  linkedin: { label: "LinkedIn" },
} as const satisfies ChapterBase<"c8"> & Record<string, unknown>;

const c9 = {
  id: "c9",
  rail: "",
  title: "Your turn.",
  titleLines: ["Your turn."],
  lede: "Trade against the agents, crash the market, check the proof. No account needed.",
  precise: "",
  enter: "Enter the arena",
} as const satisfies ChapterBase<"c9"> & Record<string, unknown>;

export const COPY = { c0, c1, c2, c3, c4, c5, c6, c7, c8, c9 } as const;

/** Chapters in page order. */
export const CHAPTER_IDS: readonly ChapterId[] = ["c0", "c1", "c2", "c3", "c4", "c5", "c6", "c7", "c8", "c9"];

/** Rail entries: 00–08 (the close has no tick; the rail stays on "08 Credit"). */
export const RAIL = CHAPTER_IDS.slice(0, 9).map((id) => ({ id, label: COPY[id].rail }));

/** Sticky chapter heights in viewport units (guide §4); the rest flow normally. */
export const CHAPTER_VH = {
  c0: 100,
  c1: 190,
  c2: 180,
  c3: 190,
  c4: 250,
  c5: 190,
  c6: 270,
} as const satisfies Partial<Record<ChapterId, number>>;

export const FOOTER = {
  left: "ApexArena · MIT · the scene on this page is simulated in your browser; tables and hashes are real engine output",
  right: "seed 42",
} as const;

/** The gate at /enter (guide §5 Gate, §6 Gate). */
export const GATE = {
  back: "Back to the overview",
  seed: "42",
  seedCaption: "seed",
  bootLabel: "Start-up steps",
  /** Each line lights at its time on the 2.6 s boot timeline. */
  boot: [
    { at: 0, text: "Seed 42 planted" },
    { at: 0.9, text: "Order book and pool open" },
    { at: 1.8, text: "Four agents awake. You make five." },
  ],
  done: "done",
  title: "The arena is open.",
  guest: "Continue as guest",
  signIn: "Sign in (coming soon)",
  note: "No account needed. Accounts arrive with hosting.",
  starting: "starting",
  open: "open",
} as const;
