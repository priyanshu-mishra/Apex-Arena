"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Badge, ConceptPill, Panel, Tabs } from "../ui";
import { useArena, fmtUsd } from "../../lib/arena";
import {
  MCP_TOOL_EXAMPLES,
  MCP_TOOL_NAMES,
  RUST_SCENARIOS,
  pipsToUnit,
  postArena,
  type ApiErr,
  type ApiResult,
  type DeterminismResponse,
  type McpResponse,
  type RustScenario,
  type SnapshotResponse,
} from "./verifyApi";
import s from "./arch.module.css";

type TabId = "rust" | "snapshot" | "mcp" | "browser";

interface HistoryEntry {
  id: number;
  at: string;
  kind: string;
  summary: string;
  ok: boolean;
  ms: number;
}

type Call<T> = { state: "idle" } | { state: "loading"; startedAt: number } | { state: "done"; result: ApiResult<T> };

const TICKS_MAX = 20_000;

/* ---------------------------------------------------------------- helpers */

function useElapsed(startedAt: number | null): number {
  const [now, setNow] = useState(0);
  useEffect(() => {
    if (startedAt === null) return;
    setNow(performance.now());
    const id = window.setInterval(() => setNow(performance.now()), 50);
    return () => window.clearInterval(id);
  }, [startedAt]);
  return startedAt === null ? 0 : Math.max(0, Math.round(now - startedAt));
}

function RunButton({ loading, startedAt, onClick, children, tone = "primary", disabled }: { loading: boolean; startedAt: number | null; onClick: () => void; children: ReactNode; tone?: string; disabled?: boolean }) {
  const elapsed = useElapsed(loading ? startedAt : null);
  return (
    <button type="button" className={`btn btn-${tone}`} onClick={onClick} disabled={loading || disabled} aria-busy={loading}>
      {loading ? (
        <>
          <span className={s.spinner} aria-hidden />
          Running… <span className="num">{elapsed} ms</span>
        </>
      ) : (
        children
      )}
    </button>
  );
}

function ErrorBox({ err }: { err: ApiErr }) {
  return (
    <div className="callout callout-ask" role="alert">
      <div className="stack" style={{ ["--gap" as string]: "6px" }}>
        <strong className="text-1">
          Request failed{err.status ? <span className="num"> ({err.status})</span> : null} after <span className="num">{err.ms} ms</span>
        </strong>
        <span style={{ whiteSpace: "pre-wrap" }}>{err.error}</span>
        {err.hint ? (
          <span>
            <strong className="text-1">Fix: </strong>
            <HintText text={err.hint} />
          </span>
        ) : null}
      </div>
    </div>
  );
}

/** Renders `code` spans for text wrapped in backticks. */
function HintText({ text }: { text: string }) {
  const parts = text.split("`");
  return (
    <>
      {parts.map((p, i) =>
        i % 2 === 1 ? (
          <code key={i} className="code-inline">
            {p}
          </code>
        ) : (
          <span key={i}>{p}</span>
        )
      )}
    </>
  );
}

function RawJson({ value, label = "Raw JSON" }: { value: unknown; label?: string }) {
  return (
    <details className={s.details}>
      <summary>{label}</summary>
      <pre className={`code-block ${s.codeTall}`}>{JSON.stringify(value, null, 2)}</pre>
    </details>
  );
}

function Verdict({ pass, title, body }: { pass: boolean; title: ReactNode; body: ReactNode }) {
  return (
    <div className={`${s.verdict} ${pass ? s.verdictPass : s.verdictFail}`} role="status">
      <span className={s.verdictIcon} style={{ background: pass ? "var(--bid)" : "var(--ask)", color: pass ? "#03140d" : "#fff" }} aria-hidden>
        {pass ? "✓" : "✕"}
      </span>
      <div className="stack" style={{ ["--gap" as string]: "2px" }}>
        <strong className="text-1" style={{ fontSize: 15 }}>
          {title}
        </strong>
        <span style={{ fontSize: 13 }}>{body}</span>
      </div>
    </div>
  );
}

function HashList({ hashes }: { hashes: string[] }) {
  const first = hashes[0];
  return (
    <div className={s.hashList}>
      {hashes.map((h, i) => (
        <div key={i} className={s.hashRow}>
          <span className="caption">Run {i + 1}</span>
          <span className={s.hashText}>{h}</span>
          <span aria-label={h === first ? "matches run 1" : "differs from run 1"} style={{ color: h === first ? "var(--bid)" : "var(--ask)", fontWeight: 700 }}>
            {h === first ? "✓" : "✕"}
          </span>
        </div>
      ))}
    </div>
  );
}

function Kv({ label, value, tone }: { label: string; value: ReactNode; tone?: string }) {
  return (
    <div className={s.stat}>
      <span className="caption">{label}</span>
      <span className={s.statValue} style={tone ? { color: tone } : undefined}>
        {value}
      </span>
    </div>
  );
}

/* ---------------------------------------------------------------- console */

export function VerificationConsole() {
  const arena = useArena();
  const { determinism, actions, frame } = arena;
  const [tab, setTab] = useState<TabId>("rust");
  const [seedStr, setSeedStr] = useState("42");
  const [ticksStr, setTicksStr] = useState("300");
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const seq = useRef(0);

  const seed = Math.max(0, Math.min(2 ** 32 - 1, Math.trunc(Number(seedStr) || 0)));
  const ticks = Math.max(1, Math.min(TICKS_MAX, Math.trunc(Number(ticksStr) || 1)));

  const log = useCallback((kind: string, summary: string, ok: boolean, ms: number) => {
    const id = ++seq.current;
    const at = new Date().toLocaleTimeString("en-US", { hour12: false });
    setHistory((h) => [{ id, at, kind, summary, ok, ms }, ...h].slice(0, 40));
  }, []);

  /* --- Rust determinism --- */
  const [rust, setRust] = useState<Call<DeterminismResponse>>({ state: "idle" });
  const runRust = async () => {
    setRust({ state: "loading", startedAt: performance.now() });
    const r = await postArena<DeterminismResponse>({ action: "verify_rust_determinism", seed, ticks });
    setRust({ state: "done", result: r });
    if (r.ok) log("Rust determinism", `seed ${r.data.seed}, ${r.data.ticks} ticks → ${r.data.all_equal ? "5/5 equal" : "MISMATCH"} ${r.data.hashes[0]?.slice(0, 12)}…`, r.data.all_equal, r.ms);
    else log("Rust determinism", r.error, false, r.ms);
  };

  /* --- Rust snapshot --- */
  const [scenario, setScenario] = useState<RustScenario>("flash-crash");
  const [snap, setSnap] = useState<Call<SnapshotResponse>>({ state: "idle" });
  const runSnap = async () => {
    setSnap({ state: "loading", startedAt: performance.now() });
    const r = await postArena<SnapshotResponse>({ action: "rust_snapshot", scenario, seed, ticks });
    setSnap({ state: "done", result: r });
    if (r.ok) log("Rust snapshot", `${r.data.scenario}, tick ${r.data.snapshot.tick}, ${r.data.snapshot.regime} → ${r.data.snapshot.state_hash.slice(0, 12)}…`, true, r.ms);
    else log("Rust snapshot", r.error, false, r.ms);
  };

  /* --- MCP --- */
  const [tool, setTool] = useState("get_market_digest");
  const [argsText, setArgsText] = useState(JSON.stringify(MCP_TOOL_EXAMPLES.get_market_digest.args, null, 2));
  const [argsError, setArgsError] = useState<string | null>(null);
  const [mcp, setMcp] = useState<Call<McpResponse>>({ state: "idle" });
  const pickTool = (name: string) => {
    setTool(name);
    setArgsText(JSON.stringify(MCP_TOOL_EXAMPLES[name]?.args ?? {}, null, 2));
    setArgsError(null);
  };
  const runMcp = async (listOnly = false) => {
    let toolArgs: unknown = {};
    if (!listOnly) {
      try {
        toolArgs = argsText.trim() ? JSON.parse(argsText) : {};
        if (typeof toolArgs !== "object" || toolArgs === null || Array.isArray(toolArgs)) throw new Error("Arguments must be a JSON object, e.g. {}.");
        setArgsError(null);
      } catch (e) {
        setArgsError(e instanceof Error ? e.message : String(e));
        return;
      }
    }
    setMcp({ state: "loading", startedAt: performance.now() });
    const r = await postArena<McpResponse>(listOnly ? { action: "tools_list", seed } : { action: "mcp_call", toolName: tool, toolArgs, seed });
    setMcp({ state: "done", result: r });
    const label = listOnly ? "tools/list" : tool;
    if (r.ok) {
      const rpcErr = r.data.response?.error;
      log("Python MCP", rpcErr ? `${label} → JSON-RPC error ${rpcErr.code}: ${rpcErr.message}` : `${label} → ok`, !rpcErr, r.ms);
    } else log("Python MCP", `${label} → ${r.error}`, false, r.ms);
  };

  /* --- In-browser kernel --- */
  const browserStart = useRef<number | null>(null);
  const [browserMs, setBrowserMs] = useState<number | null>(null);
  const runBrowser = () => {
    browserStart.current = performance.now();
    setBrowserMs(null);
    actions.verifyDeterminism(seed, ticks);
  };
  useEffect(() => {
    if (browserStart.current === null) return;
    if (determinism.status === "pass" || determinism.status === "fail") {
      const ms = Math.round(performance.now() - browserStart.current);
      browserStart.current = null;
      setBrowserMs(ms);
      log(
        "Browser kernel",
        `seed ${determinism.seed}, ${determinism.ticks} ticks → ${determinism.status === "pass" ? "5/5 equal" : "MISMATCH"} ${determinism.hashes[0]?.slice(0, 12) ?? ""}…`,
        determinism.status === "pass",
        ms
      );
    }
  }, [determinism, log]);

  const tabs: { id: TabId; label: ReactNode }[] = [
    { id: "rust", label: "Rust 5-run determinism" },
    { id: "snapshot", label: "Native Rust snapshot" },
    { id: "mcp", label: "Python MCP tool call" },
    { id: "browser", label: "In-browser kernel" },
  ];

  return (
    <Panel
      title="Live verification console"
      subtitle="Don't take our word for it. Every button below runs real code: the compiled Rust binary, the Python MCP server, or the in-browser kernel."
      explain={{
        what: "The proof that ApexArena is reproducible. Five independent kernels are run from the same seed and their full-state hashes compared; snapshots and MCP calls show the exact bytes agents see.",
        how: "Set a seed and tick count, choose a check, and run it. Each call is timed and logged below. If something fails, the error says exactly what to fix.",
        math: "The server spawns target/debug/apex-tui or python3 with validated arguments (seed 0–4,294,967,295, ticks 1–20,000, allow-listed scenarios and tools) and returns its JSON unchanged.",
      }}
      flush
    >
      <div style={{ padding: "16px 16px 0" }}>
        <div className={s.consoleControls}>
          <label className="field">
            <span className="field-label">Seed</span>
            <input className="input mono" type="number" min={0} value={seedStr} onChange={(e) => setSeedStr(e.target.value)} />
          </label>
          <label className="field">
            <span className="field-label">
              Ticks <span className="caption">× 10 ms</span>
            </span>
            <input className="input mono" type="number" min={1} max={TICKS_MAX} value={ticksStr} onChange={(e) => setTicksStr(e.target.value)} />
          </label>
          <div className="row wrap" style={{ gap: 8, paddingBottom: 4 }}>
            {[200, 300, 1000, 5000].map((t) => (
              <button key={t} type="button" className="btn btn-sm btn-ghost" aria-pressed={ticks === t} onClick={() => setTicksStr(String(t))}>
                <span className="num">{t.toLocaleString("en-US")}</span>
              </button>
            ))}
          </div>
          <span className="caption" style={{ paddingBottom: 8 }}>
            = <span className="num">{(ticks / 100).toLocaleString("en-US")}</span> s virtual time,{" "}
            <span className="num">{Math.floor(ticks / 100)}</span> macro epochs. <ConceptPill concept="determinism" label="How the check works" />
          </span>
        </div>
      </div>

      <div style={{ marginTop: 12 }}>
        <Tabs<TabId> tabs={tabs} value={tab} onChange={setTab} />
      </div>

      <div className="panel-body" role="tabpanel">
        {tab === "rust" ? (
          <div className="stack" style={{ ["--gap" as string]: "16px" }}>
            <div className="row-between wrap">
              <p className="body" style={{ fontSize: 13 }}>
                Runs <code className="code-inline">apex-tui --verify-determinism</code>: five fresh <code className="code-inline">ArenaKernel</code>s, a flash crash injected at tick{" "}
                <span className="num">{Math.floor(ticks / 2)}</span>, then a SHA-256 of the full state.
              </p>
              <RunButton loading={rust.state === "loading"} startedAt={rust.state === "loading" ? rust.startedAt : null} onClick={runRust}>
                Verify 5-run Rust determinism
              </RunButton>
            </div>
            {rust.state === "done" ? (
              rust.result.ok ? (
                <>
                  <Verdict
                    pass={rust.result.data.all_equal}
                    title={rust.result.data.all_equal ? "Bit-for-bit identical across 5 runs" : "Hashes differ — determinism broken"}
                    body={
                      <>
                        Seed <span className="num">{rust.result.data.seed}</span>, <span className="num">{rust.result.data.ticks}</span> ticks. Engine time{" "}
                        <span className="num">{rust.result.data.execMs ?? "—"} ms</span>, round trip <span className="num">{rust.result.ms} ms</span>.
                      </>
                    }
                  />
                  <HashList hashes={rust.result.data.hashes} />
                  {rust.result.data.command ? <code className="code-block">$ {rust.result.data.command}</code> : null}
                  <RawJson value={rust.result.data} />
                </>
              ) : (
                <ErrorBox err={rust.result} />
              )
            ) : rust.state === "idle" ? (
              <div className="empty">No run yet. Expect five identical 64-character hashes in well under a second.</div>
            ) : null}
          </div>
        ) : null}

        {tab === "snapshot" ? (
          <div className="stack" style={{ ["--gap" as string]: "16px" }}>
            <div className="row-between wrap" style={{ alignItems: "flex-end" }}>
              <label className="field" style={{ width: 220 }}>
                <span className="field-label">Starting regime</span>
                <select className="select" value={scenario} onChange={(e) => setScenario(e.target.value as RustScenario)}>
                  {RUST_SCENARIOS.map((sc) => (
                    <option key={sc.id} value={sc.id}>
                      {sc.label}
                    </option>
                  ))}
                </select>
              </label>
              <RunButton loading={snap.state === "loading"} startedAt={snap.state === "loading" ? snap.startedAt : null} onClick={runSnap}>
                Run native snapshot
              </RunButton>
            </div>
            {snap.state === "done" ? snap.result.ok ? <SnapshotView res={snap.result.data} ms={snap.result.ms} /> : <ErrorBox err={snap.result} /> : snap.state === "idle" ? (
              <div className="empty">Runs the kernel headless and prints its TickTelemetry as JSON. The regime may switch during the run — the Markov chain is live.</div>
            ) : null}
          </div>
        ) : null}

        {tab === "mcp" ? (
          <div className="stack" style={{ ["--gap" as string]: "16px" }}>
            <div className="grid-2" style={{ alignItems: "start" }}>
              <div className="stack" style={{ ["--gap" as string]: "12px" }}>
                <label className="field">
                  <span className="field-label">Tool</span>
                  <select className="select mono" value={tool} onChange={(e) => pickTool(e.target.value)}>
                    {MCP_TOOL_NAMES.map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </label>
                <p className="caption" style={{ fontSize: 13 }}>
                  {MCP_TOOL_EXAMPLES[tool]?.blurb}
                </p>
              </div>
              <label className="field">
                <span className="field-label">
                  Arguments (JSON)
                  <button type="button" className="btn btn-sm btn-ghost" onClick={() => pickTool(tool)}>
                    Reset example
                  </button>
                </span>
                <textarea
                  className="textarea mono"
                  rows={6}
                  spellCheck={false}
                  value={argsText}
                  aria-invalid={argsError ? true : undefined}
                  onChange={(e) => setArgsText(e.target.value)}
                  style={{ fontSize: 13 }}
                />
                {argsError ? (
                  <span className="caption" style={{ color: "var(--ask)" }} role="alert">
                    {argsError}
                  </span>
                ) : null}
              </label>
            </div>
            <div className="row wrap" style={{ gap: 8, justifyContent: "flex-end" }}>
              <button type="button" className="btn" onClick={() => runMcp(true)} disabled={mcp.state === "loading"}>
                List tools
              </button>
              <RunButton tone="llm" loading={mcp.state === "loading"} startedAt={mcp.state === "loading" ? mcp.startedAt : null} onClick={() => runMcp(false)}>
                Call {tool}
              </RunButton>
            </div>
            {mcp.state === "done" ? mcp.result.ok ? <McpView res={mcp.result.data} ms={mcp.result.ms} /> : <ErrorBox err={mcp.result} /> : mcp.state === "idle" ? (
              <div className="empty">Each call starts a fresh ApexMcpServer (seed {seed}, warmed up 20 ticks) and sends one JSON-RPC 2.0 request.</div>
            ) : null}
          </div>
        ) : null}

        {tab === "browser" ? (
          <div className="stack" style={{ ["--gap" as string]: "16px" }}>
            <div className="row-between wrap">
              <p className="body" style={{ fontSize: 13 }}>
                Runs five fresh copies of the WebWorker kernel for <span className="num">{ticks}</span> ticks with seed <span className="num">{seed}</span>, flash crash at the midpoint, without touching the live arena.
              </p>
              <RunButton tone="chaos" loading={determinism.status === "running"} startedAt={determinism.status === "running" ? browserStart.current : null} onClick={runBrowser}>
                Verify in-browser kernel
              </RunButton>
            </div>
            {determinism.status === "pass" || determinism.status === "fail" ? (
              <>
                <Verdict
                  pass={determinism.status === "pass"}
                  title={determinism.status === "pass" ? "In-browser kernel is reproducible" : "In-browser hashes differ"}
                  body={
                    <>
                      Seed <span className="num">{determinism.seed}</span>, <span className="num">{determinism.ticks}</span> ticks
                      {browserMs !== null ? (
                        <>
                          , <span className="num">{browserMs} ms</span>
                        </>
                      ) : null}
                      .
                    </>
                  }
                />
                <HashList hashes={determinism.hashes} />
              </>
            ) : determinism.status === "idle" ? (
              <div className="empty">No in-browser check yet this session.</div>
            ) : null}
            <div className="callout">
              <div className="stack" style={{ ["--gap" as string]: "6px" }}>
                <span style={{ fontSize: 13 }}>
                  Live arena state digest at tick <span className="num text-1">{frame.tick.toLocaleString("en-US")}</span>:
                </span>
                <span className={s.hashText}>{frame.stateHash}</span>
                <span className="caption">
                  The browser kernel is a JavaScript port with its own 256-bit digest of key state, so its hashes differ from the Rust SHA-256 by design. Each engine is
                  deterministic against itself; the Rust checks above are the canonical proof.
                </span>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <div className="divider" />
      <div className="panel-body">
        <div className="stack" style={{ ["--gap" as string]: "8px" }}>
          <div className="row-between">
            <span className="label">Session log</span>
            {history.length ? (
              <button type="button" className="btn btn-sm btn-ghost" onClick={() => setHistory([])}>
                Clear
              </button>
            ) : null}
          </div>
          {history.length === 0 ? (
            <div className="caption">Calls you make in this session appear here with their timing.</div>
          ) : (
            <div className={s.history} role="log" aria-live="polite">
              {history.map((h) => (
                <div key={h.id} className={s.historyRow}>
                  <span className="num caption">{h.at}</span>
                  <span className="caption">{h.kind}</span>
                  <span style={{ minWidth: 0, overflowWrap: "anywhere", color: h.ok ? "var(--text-2)" : "var(--ask)" }}>{h.summary}</span>
                  <span className="num caption" style={{ textAlign: "right" }}>
                    <span className="dot" style={{ ["--accent" as string]: h.ok ? "var(--bid)" : "var(--ask)", marginRight: 6 }} />
                    {h.ms} ms
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Panel>
  );
}

/* ---------------------------------------------------------------- result views */

function SnapshotView({ res, ms }: { res: SnapshotResponse; ms: number }) {
  const sn = res.snapshot;
  const mid = pipsToUnit(sn.clob_mid_price);
  const spot = pipsToUnit(sn.evm_spot_price);
  const basis = spot ? ((mid - spot) / spot) * 10_000 : 0;
  const x = pipsToUnit(sn.evm_reserve_base);
  const y = pipsToUnit(sn.evm_reserve_quote);
  const depth = 5;
  const asks = sn.book.asks.slice(0, depth).reverse();
  const bids = sn.book.bids.slice(0, depth);
  return (
    <div className="stack" style={{ ["--gap" as string]: "16px" }}>
      <div className="row wrap" style={{ gap: 8 }}>
        <Badge tone={sn.regime === "FlashCrash" ? "ask" : sn.regime === "Calm" ? "bid" : "chaos"}>{sn.regime}</Badge>
        <span className="caption">
          Started as {res.scenario}, seed <span className="num">{res.seed}</span>. Engine <span className="num">{res.execMs ?? "—"} ms</span>, round trip <span className="num">{ms} ms</span>.
        </span>
      </div>
      <div className={s.statGrid}>
        <Kv label="Tick" value={sn.tick.toLocaleString("en-US")} />
        <Kv label="Virtual time" value={`${((sn.tick * 10) / 1000).toFixed(2)} s`} />
        <Kv label="CLOB mid" value={fmtUsd(mid)} tone="var(--bid)" />
        <Kv label="Revm spot" value={fmtUsd(spot)} tone="var(--evm)" />
        <Kv label="Basis" value={`${basis >= 0 ? "+" : ""}${basis.toFixed(1)} bps`} tone={Math.abs(basis) > 34 ? "var(--chaos)" : undefined} />
        <Kv label="Spread" value={`${sn.spread_bps} bps`} />
        <Kv label="Hawkes λ(t)" value={pipsToUnit(sn.hawkes_intensity_pips).toFixed(4)} tone="var(--chaos)" />
        <Kv label="Pool reserves" value={`${x.toFixed(2)} ETH / ${(y / 1e6).toFixed(3)}M`} />
        <Kv label="Block" value={`#${sn.block_number.toLocaleString("en-US")}`} />
      </div>
      <div className="stack" style={{ ["--gap" as string]: "4px" }}>
        <span className="label">State hash (SHA-256)</span>
        <span className={s.hashText}>{sn.state_hash}</span>
      </div>
      <div className={s.sideBySide}>
        <div className="stack" style={{ ["--gap" as string]: "6px" }}>
          <span className="label">Order book (top {depth})</span>
          <table className="table">
            <thead>
              <tr>
                <th>Side</th>
                <th className="r">Price</th>
                <th className="r">Size (ETH)</th>
              </tr>
            </thead>
            <tbody>
              {asks.map((l, i) => (
                <tr key={`a${i}`}>
                  <td style={{ color: "var(--ask)" }}>Ask</td>
                  <td className="r num" style={{ color: "var(--ask)" }}>
                    {fmtUsd(pipsToUnit(l.price))}
                  </td>
                  <td className="r num">{pipsToUnit(l.total_qty).toFixed(3)}</td>
                </tr>
              ))}
              {bids.map((l, i) => (
                <tr key={`b${i}`}>
                  <td style={{ color: "var(--bid)" }}>Bid</td>
                  <td className="r num" style={{ color: "var(--bid)" }}>
                    {fmtUsd(pipsToUnit(l.price))}
                  </td>
                  <td className="r num">{pipsToUnit(l.total_qty).toFixed(3)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="stack" style={{ ["--gap" as string]: "6px" }}>
          <span className="label">Leaderboard</span>
          <div style={{ overflowX: "auto" }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Agent</th>
                  <th className="r">PnL</th>
                  <th className="r">ACS</th>
                </tr>
              </thead>
              <tbody>
                {sn.leaderboard.map((a) => (
                  <tr key={a.agent_id}>
                    <td>
                      <span className="text-1">{a.agent_id}</span>{" "}
                      {a.status !== "Active" ? <Badge tone="ask">Liquidated</Badge> : null}
                    </td>
                    <td className="r num" style={{ color: a.pnl_bps >= 0 ? "var(--bid)" : "var(--ask)" }}>
                      {a.pnl_bps >= 0 ? "+" : ""}
                      {a.pnl_bps} bps
                    </td>
                    <td className="r num text-1">{(a.acs_score_bps / 10_000).toFixed(4)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      {res.command ? <code className="code-block">$ {res.command}</code> : null}
      <RawJson value={res.snapshot} label="Raw TickTelemetry JSON" />
    </div>
  );
}

function McpView({ res, ms }: { res: McpResponse; ms: number }) {
  const rpc = res.response;
  const sc = rpc?.result?.structuredContent;
  const tools = rpc?.result?.tools;
  const hash = sc && typeof sc.state_hash === "string" ? sc.state_hash : null;
  return (
    <div className="stack" style={{ ["--gap" as string]: "14px" }}>
      {rpc?.error ? (
        <Verdict pass={false} title={`JSON-RPC error ${rpc.error.code}`} body={rpc.error.message} />
      ) : (
        <Verdict
          pass
          title="JSON-RPC 2.0 call succeeded"
          body={
            <>
              Python + PyO3 time <span className="num">{res.execMs ?? "—"} ms</span>, round trip <span className="num">{ms} ms</span>
              {hash ? (
                <>
                  . State hash <span className="num">{hash.slice(0, 16)}…</span>
                </>
              ) : null}
            </>
          }
        />
      )}
      {tools ? (
        <table className="table">
          <thead>
            <tr>
              <th>Tool</th>
              <th>What it does</th>
            </tr>
          </thead>
          <tbody>
            {tools.map((t) => (
              <tr key={t.name}>
                <td className="mono text-1" style={{ whiteSpace: "nowrap" }}>
                  {t.name}
                </td>
                <td>{t.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
      <div className={s.sideBySide}>
        <div className="stack" style={{ ["--gap" as string]: "6px" }}>
          <span className="label">Request</span>
          <pre className={`code-block ${s.codeTall}`}>{JSON.stringify(res.request, null, 2)}</pre>
        </div>
        <div className="stack" style={{ ["--gap" as string]: "6px" }}>
          <span className="label">Response {sc ? "(structuredContent)" : ""}</span>
          <pre className={`code-block ${s.codeTall}`}>{JSON.stringify(sc ?? rpc, null, 2)}</pre>
        </div>
      </div>
      <RawJson value={rpc} label="Full JSON-RPC response envelope" />
    </div>
  );
}
