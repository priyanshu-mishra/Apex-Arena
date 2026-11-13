// Pure parser for apex-tui JSON output. Prices and sizes are integer pips (SCALE = 10^8).
export type RealData = {
  seed: 42;
  ticks: 300;
  scenario: "flash-crash";
  hash: string;
  hashesEqual: boolean;
  mid: number;
  asks: [price: number, size: number][];
  lambdaCalm: number;
  leaderboard: {
    agentId: string;
    role: string;
    pnlBps: number;
    maxDrawdownBps: number;
    psr: number;
    calmar: number;
    survival: number;
    acs: number;
    liquidated: boolean;
  }[];
};

const PIPS = 1e8;
const DEFAULT_LAMBDA_CALM = 0.2;

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;

function num(o: Record<string, unknown>, k: string): number {
  const v = o[k];
  if (typeof v !== "number" || !Number.isFinite(v)) throw new Error(`apex-tui: expected number at "${k}"`);
  return v;
}
function str(o: Record<string, unknown>, k: string): string {
  const v = o[k];
  if (typeof v !== "string" || v.length === 0) throw new Error(`apex-tui: expected string at "${k}"`);
  return v;
}
function arr(o: Record<string, unknown>, k: string): unknown[] {
  const v = o[k];
  if (!Array.isArray(v)) throw new Error(`apex-tui: expected array at "${k}"`);
  return v;
}

export function parseTui(snapshot: unknown, verify: unknown, calm?: unknown): RealData {
  if (!isObj(snapshot) || !isObj(verify)) throw new Error("apex-tui: malformed input");
  const book = snapshot.book;
  if (!isObj(book)) throw new Error('apex-tui: missing "book"');

  const asks = arr(book, "asks").map((l): [number, number] => {
    if (!isObj(l)) throw new Error("apex-tui: malformed ask level");
    return [num(l, "price") / PIPS, num(l, "total_qty") / PIPS];
  });

  const leaderboard = arr(snapshot, "leaderboard").map((e) => {
    if (!isObj(e)) throw new Error("apex-tui: malformed leaderboard entry");
    const liquidated = e.status === "Liquidated";
    const role = liquidated
      ? "liquidated at the 5% margin limit"
      : e.kind === "AiReasoning"
        ? "reasoning agent"
        : "quant algorithm";
    return {
      agentId: str(e, "agent_id"),
      role,
      pnlBps: num(e, "pnl_bps"),
      maxDrawdownBps: num(e, "max_drawdown_bps"),
      psr: num(e, "psr_bps") / 10000,
      calmar: num(e, "calmar_capped_bps") / 10000,
      survival: num(e, "ood_survival_bps") / 10000,
      acs: num(e, "acs_score_bps") / 10000,
      liquidated,
    };
  });

  const hashes = arr(verify, "hashes");
  if (typeof hashes[0] !== "string") throw new Error('apex-tui: missing "hashes"');
  if (typeof verify.all_equal !== "boolean") throw new Error('apex-tui: missing "all_equal"');

  const lambdaCalm =
    isObj(calm) && typeof calm.hawkes_intensity_pips === "number"
      ? calm.hawkes_intensity_pips / PIPS
      : DEFAULT_LAMBDA_CALM;

  return {
    seed: 42,
    ticks: 300,
    scenario: "flash-crash",
    hash: hashes[0],
    hashesEqual: verify.all_equal,
    mid: num(snapshot, "clob_mid_price") / PIPS,
    asks,
    lambdaCalm,
    leaderboard,
  };
}
