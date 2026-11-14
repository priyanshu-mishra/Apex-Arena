"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Badge, ConceptPill, Panel, Tabs } from "../ui";
import { useArena, fmtUsd } from "../../lib/arena";
import { useDensity } from "../../lib/density";
import { cn } from "../../lib/utils";
import { HashRows } from "../landing/HashRows";
import { btn, caption, codeBlock, codeInline, dot, empty, field, fieldLabel, input, label, mono12, num, select, table, td, tdNum, textarea, th } from "../ui/kit";
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

type TabId = "snapshot" | "mcp" | "browser";

/** Dim placeholder rows before the first run. */
const PENDING = Array.from({ length: 5 }, () => "·".repeat(64));

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

function RunButton({ loading, startedAt, onClick, children, primary, disabled }: { loading: boolean; startedAt: number | null; onClick: () => void; children: ReactNode; primary?: boolean; disabled?: boolean }) {
  const elapsed = useElapsed(loading ? startedAt : null);
  return (
    <button type="button" className={btn(primary ? "primary" : "ghost", primary ? "lg" : "md")} onClick={onClick} disabled={loading || disabled} aria-busy={loading}>
      {loading ? (
        <>
          Running… <span className={num}>{elapsed} ms</span>
        </>
      ) : (
        children
      )}
    </button>
  );
}

function ErrorBox({ err }: { err: ApiErr }) {
  return (
    <div className="flex flex-col gap-1.5 border-l border-rule-2 py-1 pl-3 font-sans text-[13.5px] leading-[1.5] text-bone-2" role="alert">
      <strong className="font-semibold text-bone">
        Request failed{err.status ? <span className={num}> ({err.status})</span> : null} after <span className={num}>{err.ms} ms</span>
      </strong>
      <span className="whitespace-pre-wrap">{err.error}</span>
      {err.hint ? (
        <span>
          <strong className="font-semibold text-bone">Fix: </strong>
          <HintText text={err.hint} />
        </span>
      ) : null}
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
          <code key={i} className={codeInline}>
            {p}
          </code>
        ) : (
          <span key={i}>{p}</span>
        )
      )}
    </>
  );
}

function RawJson({ value, label: l = "Raw JSON" }: { value: unknown; label?: string }) {
  return (
    <details className="group">
      <summary className="cursor-pointer font-sans text-[13px] text-bone-2 hover:text-bone">{l}</summary>
      <pre className={cn(codeBlock, "mt-2 max-h-[420px]")}>{JSON.stringify(value, null, 2)}</pre>
    </details>
  );
}

function Verdict({ pass, title, body }: { pass: boolean; title: ReactNode; body: ReactNode }) {
  return (
    <div className={cn("flex flex-col gap-1 border-l py-1 pl-3", "border-rule-2")} role="status">
      <strong className={cn("font-sans text-[15px] font-semibold [font-variation-settings:'wdth'_108]", pass ? "text-bid" : "text-ask")}>{title}</strong>
      <span className="font-sans text-[13px] text-bone-2">{body}</span>
    </div>
  );
}

function HashList({ hashes }: { hashes: string[] }) {
  const first = hashes[0];
  return (
    <div className="border-t border-rule-2">
      {hashes.map((h, i) => (
        <div key={i} className="grid grid-cols-[4.5em_minmax(0,1fr)_auto] items-center gap-3 border-b border-rule py-2">
          <span className={cn(mono12, "text-bone-2")}>run {i + 1}</span>
          <span className={cn(mono12, "truncate text-bone")}>{h}</span>
          <span className={cn(mono12, h === first ? "text-bid" : "text-ask")}>{h === first ? "match" : "differs"}</span>
        </div>
      ))}
    </div>
  );
}

function Kv({ label: l, value, tone }: { label: string; value: ReactNode; tone?: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className={cn(label, "text-[12px]")}>{l}</span>
      <span className={cn(mono12, "text-[13px] break-words text-bone")} style={tone ? { color: tone } : undefined}>
        {value}
      </span>
    </div>
  );
}

/* ---------------------------------------------------------------- console */

export function VerificationConsole() {
  const arena = useArena();
  const { determinism, actions, frame } = arena;
  const [density] = useDensity();
  const pro = density === "pro";
  const [tab, setTab] = useState<TabId>("snapshot");
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
    { id: "snapshot", label: "Native Rust snapshot" },
    { id: "mcp", label: "Python MCP tool call" },
    { id: "browser", label: "In-browser kernel" },
  ];

  /* The Rust check drives the landing's hash rows: dim until the run returns, then lit with match / differs. */
  const rustData = rust.state === "done" && rust.result.ok ? rust.result.data : null;
  const rowHashes = rustData ? rustData.hashes : PENDING;
  const rowMatches = rustData ? rustData.hashes.map((h) => h === rustData.hashes[0]) : undefined;

  return (
    <>
      <Panel
        title="Rust 5-run check"
        subtitle={`Five fresh Rust kernels, seed ${seed}, ${ticks.toLocaleString("en-US")} ticks, a flash crash at tick ${Math.floor(ticks / 2).toLocaleString("en-US")}, then a SHA-256 of the full state`}
        explain={{
          what: "The proof that ApexArena is reproducible. Five independent Rust kernels are run from the same seed and their full-state SHA-256 hashes compared. If all five match, the market replays bit for bit.",
          how: pro
            ? "Set a seed and tick count, then run. The call is timed and logged in the console below. If something fails, the error says exactly what to fix."
            : "Press the button. The compiled Rust binary runs on this machine and the five hashes appear in the rows. Switch to Pro to change the seed and tick count.",
          math: "The server spawns target/debug/apex-tui --verify-determinism with validated arguments (seed 0–4,294,967,295, ticks 1–20,000) and returns its JSON unchanged. The kernel uses no floats, no hash maps and no wall clock.",
        }}
      >
        <div className="flex flex-col gap-5">
          <div className="flex flex-wrap items-end gap-x-5 gap-y-4">
            <RunButton primary loading={rust.state === "loading"} startedAt={rust.state === "loading" ? rust.startedAt : null} onClick={runRust}>
              Verify 5-run Rust determinism
            </RunButton>
            {pro ? (
              <>
                <label className={cn(field, "w-[130px]")}>
                  <span className={fieldLabel}>Seed</span>
                  <input className={input} type="number" min={0} value={seedStr} onChange={(e) => setSeedStr(e.target.value)} />
                </label>
                <label className={cn(field, "w-[130px]")}>
                  <span className={fieldLabel}>Ticks × 10 ms</span>
                  <input className={input} type="number" min={1} max={TICKS_MAX} value={ticksStr} onChange={(e) => setTicksStr(e.target.value)} />
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {[200, 300, 1000, 5000].map((t) => (
                    <button key={t} type="button" className={btn("ghost", "sm", num)} aria-pressed={ticks === t} onClick={() => setTicksStr(String(t))}>
                      {t.toLocaleString("en-US")}
                    </button>
                  ))}
                </div>
              </>
            ) : null}
            <span className={cn(caption, "basis-full")}>
              = {(ticks / 100).toLocaleString("en-US")} s virtual time, {Math.floor(ticks / 100)} macro epochs.{" "}
              <ConceptPill concept="determinism" label="How the check works" />
            </span>
          </div>

          <HashRows
            hashes={rowHashes}
            lit={rustData ? rowHashes.length : 0}
            matches={rowMatches}
            label={rustData ? `Five Rust runs with seed ${rustData.seed}: ${rowMatches?.filter(Boolean).length ?? 0} of 5 share one SHA-256 state hash` : "Five Rust runs, not yet run"}
          />

          {rust.state === "done" && !rust.result.ok ? <ErrorBox err={rust.result} /> : null}
          {rust.state === "idle" ? <p className={caption}>No run yet. Expect five identical 64-character hashes in well under a second.</p> : null}
          {rustData ? (
            <p className={cn(caption)}>
              Seed <span className={num}>{rustData.seed}</span>, <span className={num}>{rustData.ticks}</span> ticks. Engine time{" "}
              <span className={num}>{rustData.execMs ?? "—"} ms</span>, round trip{" "}
              <span className={num}>{rust.state === "done" ? rust.result.ms : "—"} ms</span>.
            </p>
          ) : null}
          {pro && rustData ? (
            <div className="flex flex-col gap-3">
              {rustData.command ? <code className={codeBlock}>$ {rustData.command}</code> : null}
              <RawJson value={rustData} />
            </div>
          ) : null}
        </div>
      </Panel>

      {pro ? (
        <Panel
          title="Verification console"
          subtitle="Every button runs real code: the compiled Rust binary, the Python MCP server, or the in-browser kernel"
          explain={{
            what: "Snapshots and MCP calls show the exact bytes agents see; the in-browser check runs the JavaScript port five times.",
            how: "Choose a check and run it with the seed and tick count above. Each call is timed and logged below.",
            math: "The server spawns target/debug/apex-tui or python3 with validated arguments (allow-listed scenarios and tools) and returns its JSON unchanged.",
          }}
          flush
        >
          <Tabs<TabId> ariaLabel="Checks" tabs={tabs} value={tab} onChange={setTab} />

          <div className="p-4" role="tabpanel">
            {tab === "snapshot" ? (
              <div className="flex flex-col gap-4">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <label className={cn(field, "w-[220px]")}>
                    <span className={fieldLabel}>Starting regime</span>
                    <select className={select} value={scenario} onChange={(e) => setScenario(e.target.value as RustScenario)}>
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
                  <p className={cn(empty, "px-0")}>Runs the kernel headless and prints its TickTelemetry as JSON. The regime may switch during the run — the Markov chain is live.</p>
                ) : null}
              </div>
            ) : null}

            {tab === "mcp" ? (
              <div className="flex flex-col gap-4">
                <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
                  <div className="flex flex-col gap-3">
                    <label className={field}>
                      <span className={fieldLabel}>Tool</span>
                      <select className={cn(select, "font-mono text-[13px]")} value={tool} onChange={(e) => pickTool(e.target.value)}>
                        {MCP_TOOL_NAMES.map((n) => (
                          <option key={n} value={n}>
                            {n}
                          </option>
                        ))}
                      </select>
                    </label>
                    <p className="font-sans text-[13px] leading-[1.5] text-bone-2">{MCP_TOOL_EXAMPLES[tool]?.blurb}</p>
                  </div>
                  <label className={field}>
                    <span className={fieldLabel}>
                      Arguments (JSON)
                      <button type="button" className={btn("ghost", "sm")} onClick={() => pickTool(tool)}>
                        Reset example
                      </button>
                    </span>
                    <textarea
                      className={textarea}
                      rows={6}
                      spellCheck={false}
                      value={argsText}
                      aria-invalid={argsError ? true : undefined}
                      onChange={(e) => setArgsText(e.target.value)}
                    />
                    {argsError ? (
                      <span className="font-sans text-[12.5px] text-ask" role="alert">
                        {argsError}
                      </span>
                    ) : null}
                  </label>
                </div>
                <div className="flex flex-wrap justify-end gap-2">
                  <button type="button" className={btn()} onClick={() => runMcp(true)} disabled={mcp.state === "loading"}>
                    List tools
                  </button>
                  <RunButton loading={mcp.state === "loading"} startedAt={mcp.state === "loading" ? mcp.startedAt : null} onClick={() => runMcp(false)}>
                    Call {tool}
                  </RunButton>
                </div>
                {mcp.state === "done" ? mcp.result.ok ? <McpView res={mcp.result.data} ms={mcp.result.ms} /> : <ErrorBox err={mcp.result} /> : mcp.state === "idle" ? (
                  <p className={cn(empty, "px-0")}>Each call starts a fresh ApexMcpServer (seed {seed}, warmed up 20 ticks) and sends one JSON-RPC 2.0 request.</p>
                ) : null}
              </div>
            ) : null}

            {tab === "browser" ? (
              <div className="flex flex-col gap-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="max-w-[46em] font-sans text-[13.5px] leading-[1.5] text-bone-2">
                    Runs five fresh copies of the WebWorker kernel for <span className={num}>{ticks}</span> ticks with seed <span className={num}>{seed}</span>, flash crash at the
                    midpoint, without touching the live arena. Its digest is a 256-bit FNV-1a, not SHA-256.
                  </p>
                  <RunButton loading={determinism.status === "running"} startedAt={determinism.status === "running" ? browserStart.current : null} onClick={runBrowser}>
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
                          Seed <span className={num}>{determinism.seed}</span>, <span className={num}>{determinism.ticks}</span> ticks
                          {browserMs !== null ? (
                            <>
                              , <span className={num}>{browserMs} ms</span>
                            </>
                          ) : null}
                          .
                        </>
                      }
                    />
                    <HashList hashes={determinism.hashes} />
                  </>
                ) : determinism.status === "idle" ? (
                  <p className={cn(empty, "px-0")}>No in-browser check yet this session.</p>
                ) : null}
                <div className="flex flex-col gap-1.5 border-t border-rule pt-3">
                  <span className="font-sans text-[13px] text-bone-2">
                    Live arena FNV-1a digest at tick <span className={cn(num, "text-bone")}>{frame.tick.toLocaleString("en-US")}</span>:
                  </span>
                  <span className={cn(mono12, "break-all text-bone")}>{frame.stateHash}</span>
                  <span className={caption}>
                    The browser kernel is a JavaScript port with its own 256-bit FNV-1a digest of key state, so its hashes differ from the Rust SHA-256 by design. Each
                    engine is deterministic against itself; the Rust check above is the canonical proof.
                  </span>
                </div>
              </div>
            ) : null}
          </div>

          <div className="flex flex-col gap-2 border-t border-rule p-4">
            <div className="flex items-center justify-between">
              <span className={label}>Session log</span>
              {history.length ? (
                <button type="button" className={btn("ghost", "sm")} onClick={() => setHistory([])}>
                  Clear
                </button>
              ) : null}
            </div>
            {history.length === 0 ? (
              <p className={caption}>Calls you make in this session appear here with their timing.</p>
            ) : (
              <div className="flex flex-col" role="log" aria-live="polite">
                {history.map((h) => (
                  <div key={h.id} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-baseline gap-x-3 gap-y-1 border-b border-rule py-2 sm:grid-cols-[5.5em_9em_minmax(0,1fr)_auto]">
                    <span className={cn(mono12, "text-bone-3")}>{h.at}</span>
                    <span className="font-sans text-[12.5px] text-bone-2">{h.kind}</span>
                    <span className={cn(mono12, "col-span-3 break-words sm:col-span-1", h.ok ? "text-bone-2" : "text-ask")}>{h.summary}</span>
                    <span className={cn(mono12, "flex items-center justify-end gap-2 text-bone-3")}>
                      <span className={dot} style={{ background: h.ok ? "var(--bid)" : "var(--ask)" }} aria-hidden />
                      {h.ms} ms
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Panel>
      ) : null}
    </>
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
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={sn.regime === "FlashCrash" ? "ask" : sn.regime === "Calm" ? "bid" : "chaos"}>{sn.regime}</Badge>
        <span className={caption}>
          Started as {res.scenario}, seed <span className={num}>{res.seed}</span>. Engine <span className={num}>{res.execMs ?? "—"} ms</span>, round trip{" "}
          <span className={num}>{ms} ms</span>.
        </span>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3 lg:grid-cols-5">
        <Kv label="Tick" value={sn.tick.toLocaleString("en-US")} />
        <Kv label="Virtual time" value={`${((sn.tick * 10) / 1000).toFixed(2)} s`} />
        <Kv label="CLOB mid" value={fmtUsd(mid)} />
        <Kv label="Revm spot" value={fmtUsd(spot)} tone="var(--pool)" />
        <Kv label="Basis" value={`${basis >= 0 ? "+" : ""}${basis.toFixed(1)} bps`} tone={Math.abs(basis) > 34 ? "var(--shock)" : undefined} />
        <Kv label="Spread" value={`${sn.spread_bps} bps`} />
        <Kv label="Hawkes λ(t)" value={pipsToUnit(sn.hawkes_intensity_pips).toFixed(4)} tone="var(--shock)" />
        <Kv label="Pool reserves" value={`${x.toFixed(2)} ETH / ${(y / 1e6).toFixed(3)}M`} />
        <Kv label="Block" value={`#${sn.block_number.toLocaleString("en-US")}`} />
      </div>
      <div className="flex flex-col gap-1">
        <span className={label}>State hash (SHA-256)</span>
        <span className={cn(mono12, "break-all text-bone")}>{sn.state_hash}</span>
      </div>
      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-2">
          <span className={label}>Order book (top {depth})</span>
          <table className={table}>
            <thead>
              <tr>
                <th className={th}>Side</th>
                <th className={cn(th, "text-right")}>Price</th>
                <th className={cn(th, "text-right")}>Size (ETH)</th>
              </tr>
            </thead>
            <tbody>
              {asks.map((l, i) => (
                <tr key={`a${i}`}>
                  <td className={td}>Ask</td>
                  <td className={cn(tdNum, "text-ask")}>{fmtUsd(pipsToUnit(l.price))}</td>
                  <td className={tdNum}>{pipsToUnit(l.total_qty).toFixed(3)}</td>
                </tr>
              ))}
              {bids.map((l, i) => (
                <tr key={`b${i}`}>
                  <td className={td}>Bid</td>
                  <td className={cn(tdNum, "text-bid")}>{fmtUsd(pipsToUnit(l.price))}</td>
                  <td className={tdNum}>{pipsToUnit(l.total_qty).toFixed(3)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex min-w-0 flex-col gap-2">
          <span className={label}>Leaderboard</span>
          <div className="max-w-full overflow-x-auto">
            <table className={table}>
              <thead>
                <tr>
                  <th className={th}>Agent</th>
                  <th className={cn(th, "text-right")}>PnL</th>
                  <th className={cn(th, "text-right")}>ACS</th>
                </tr>
              </thead>
              <tbody>
                {sn.leaderboard.map((a) => (
                  <tr key={a.agent_id}>
                    <td className={td}>
                      <span className={cn("text-bone", a.status !== "Active" && "text-bone-3 line-through")}>{a.agent_id}</span>{" "}
                      {a.status !== "Active" ? <span className="text-ask">liquidated</span> : null}
                    </td>
                    <td className={tdNum} style={{ color: a.pnl_bps >= 0 ? "var(--bid)" : "var(--ask)" }}>
                      {a.pnl_bps >= 0 ? "+" : ""}
                      {a.pnl_bps} bps
                    </td>
                    <td className={tdNum}>{(a.acs_score_bps / 10_000).toFixed(4)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      {res.command ? <code className={codeBlock}>$ {res.command}</code> : null}
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
    <div className="flex min-w-0 flex-col gap-4">
      {rpc?.error ? (
        <Verdict pass={false} title={`JSON-RPC error ${rpc.error.code}`} body={rpc.error.message} />
      ) : (
        <Verdict
          pass
          title="JSON-RPC 2.0 call succeeded"
          body={
            <>
              Python + PyO3 time <span className={num}>{res.execMs ?? "—"} ms</span>, round trip <span className={num}>{ms} ms</span>
              {hash ? (
                <>
                  . State hash <span className={num}>{hash.slice(0, 16)}…</span>
                </>
              ) : null}
            </>
          }
        />
      )}
      {tools ? (
        <div className="max-w-full overflow-x-auto">
          <table className={table}>
            <thead>
              <tr>
                <th className={th}>Tool</th>
                <th className={th}>What it does</th>
              </tr>
            </thead>
            <tbody>
              {tools.map((t) => (
                <tr key={t.name}>
                  <td className={cn(td, mono12, "whitespace-nowrap text-bone")}>{t.name}</td>
                  <td className={td}>{t.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-2">
          <span className={label}>Request</span>
          <pre className={cn(codeBlock, "max-h-[420px]")}>{JSON.stringify(res.request, null, 2)}</pre>
        </div>
        <div className="flex min-w-0 flex-col gap-2">
          <span className={label}>Response {sc ? "(structuredContent)" : ""}</span>
          <pre className={cn(codeBlock, "max-h-[420px]")}>{JSON.stringify(sc ?? rpc, null, 2)}</pre>
        </div>
      </div>
      <RawJson value={rpc} label="Full JSON-RPC response envelope" />
    </div>
  );
}
