"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { fmtSigned, fmtUsd, useArena } from "../../lib/arena";
import type { CustomAgentConfig, LeaderboardEntryUi } from "../../lib/sharedBuffer";
import { Badge, ConceptPill, Panel } from "../ui";
import {
  ARCHETYPES,
  REALIZED_VOL_BPS,
  SCALE,
  previewStrategy,
  startInventoryEth,
  validateName,
  type Archetype,
  type BuilderParams,
} from "./model";
import styles from "./Lab.module.css";

function nextFreeName(base: string, board: LeaderboardEntryUi[]): string {
  const taken = new Set(board.map((e) => e.agentId.toLowerCase()));
  for (let v = 1; v < 1000; v++) {
    const n = `${base}-v${v}`;
    if (!taken.has(n.toLowerCase())) return n;
  }
  return `${base}-${Date.now()}`;
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  format,
  hint,
  onChange,
}: {
  label: React.ReactNode;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
  hint: React.ReactNode;
  onChange: (v: number) => void;
}) {
  const id = useId();
  return (
    <div className="field">
      <label className="field-label" htmlFor={id}>
        <span>{label}</span>
        <span className={styles.sliderValue}>{format(value)}</span>
      </label>
      <input
        id={id}
        className="range"
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-valuetext={format(value)}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <span className={styles.sliderHint}>{hint}</span>
    </div>
  );
}

const DEFAULTS: Omit<BuilderParams, "name"> = {
  archetype: "NEURO_LLM_MM",
  gamma: 0.25,
  baseSpreadBps: 12,
  inventoryTargetEth: 0,
  oodLambdaThreshold: 0.8,
  oodSpreadMultiplier: 2.5,
  arbAggressivenessPct: 50,
  maxDrawdownLimitBps: 1500,
  orderSizeEth: 2.5,
};

export function AgentBuilder() {
  const { frame, actions } = useArena();
  const [p, setP] = useState<BuilderParams>(() => ({ ...DEFAULTS, name: "Custom-Alpha-v1" }));
  const [touched, setTouched] = useState(false);
  const archRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const nameId = useId();
  const errId = useId();

  // Pick a free default name once the leaderboard is known.
  const boardReady = frame.leaderboard.length > 0;
  useEffect(() => {
    if (boardReady && !touched) setP((s) => ({ ...s, name: nextFreeName("Custom-Alpha", frame.leaderboard) }));
  }, [boardReady]);

  const set = <K extends keyof BuilderParams>(k: K, v: BuilderParams[K]) => setP((s) => ({ ...s, [k]: v }));
  const error = validateName(p.name, frame.leaderboard);
  const pv = useMemo(() => previewStrategy(p, frame), [p, frame]);
  const lambda = frame.hawkesIntensityPips / SCALE;
  const arch = ARCHETYPES.find((a) => a.id === p.archetype)!;

  const deploy = () => {
    setTouched(true);
    if (error) return;
    const config: CustomAgentConfig = {
      agentId: p.name.trim(),
      archetype: p.archetype,
      baseSpreadBps: p.baseSpreadBps,
      oodSpreadMultiplier: p.oodSpreadMultiplier,
      maxDrawdownLimitBps: p.maxDrawdownLimitBps,
      orderSizeEth: p.orderSizeEth,
    };
    actions.deployAgent(config);
    const base = config.agentId.replace(/-v\d+$/i, "");
    setP((s) => ({ ...s, name: nextFreeName(base, [...frame.leaderboard, { agentId: config.agentId } as LeaderboardEntryUi]) }));
    setTouched(false);
  };

  const onArchKey = (e: React.KeyboardEvent, i: number) => {
    const delta = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!delta) return;
    e.preventDefault();
    const n = (i + delta + ARCHETYPES.length) % ARCHETYPES.length;
    set("archetype", ARCHETYPES[n].id);
    archRefs.current[n]?.focus();
  };

  // Mini ladder layout: bid, reservation, mid, ask on one axis.
  const pts = [pv.bid, pv.reservation, pv.mid, pv.ask];
  const lo = Math.min(...pts);
  const hi = Math.max(...pts);
  const pad = Math.max((hi - lo) * 0.25, pv.mid * 0.0002);
  const x = (v: number) => ((v - (lo - pad)) / (hi - lo + 2 * pad)) * 100;
  const showErr = touched || p.name.trim().length > 0;

  return (
    <Panel
      title="Custom agent builder"
      subtitle="Design a strategy, preview its quotes against the live book, then deploy it into the arena"
      explain={{
        what: (
          <>
            Configure your own agent and drop it into the running simulation. It trades against the LLM and quant agents in real time and
            is scored with the same Apex Composite Score on the leaderboard.
          </>
        ),
        how: (
          <>
            Pick an archetype, tune the sliders and watch the preview: it recomputes the bid and ask your agent would post right now. When
            you deploy, the worker receives the archetype, base spread, OOD multiplier, drawdown limit and order size. Risk aversion,
            inventory target, the OOD trigger level and arbitrage aggressiveness shape the preview and the strategy description.
          </>
        ),
        math: (
          <>
            Avellaneda-Stoikov reservation price r = mid − q·γ·σ², where q is inventory minus target (ETH), γ is risk aversion and σ is
            per-tick price volatility (the regime&apos;s realized vol scaled from one epoch to one 10 ms tick). Quotes are r ± spread / 2, with
            the spread multiplied by the OOD factor while λ(t) is at or above your trigger. The skew is capped at one full spread.
          </>
        ),
      }}
    >
      <div className={styles.builder}>
        <form
          className="stack"
          style={{ ["--gap" as string]: "20px" }}
          onSubmit={(e) => {
            e.preventDefault();
            deploy();
          }}
          noValidate
        >
          <div className="field">
            <label className="field-label" htmlFor={nameId}>
              Agent name
            </label>
            <input
              id={nameId}
              className="input"
              value={p.name}
              maxLength={40}
              autoComplete="off"
              spellCheck={false}
              aria-invalid={showErr && !!error}
              aria-describedby={error ? errId : undefined}
              onChange={(e) => {
                setTouched(true);
                set("name", e.target.value);
              }}
            />
            {showErr && error ? (
              <span id={errId} className={styles.error} role="alert">
                {error}
              </span>
            ) : null}
          </div>

          <div className="field">
            <span className="field-label" id={`${nameId}-arch`}>
              Archetype
            </span>
            <div className={styles.archetypes} role="radiogroup" aria-labelledby={`${nameId}-arch`}>
              {ARCHETYPES.map((a, i) => (
                <button
                  key={a.id}
                  ref={(el) => {
                    archRefs.current[i] = el;
                  }}
                  type="button"
                  role="radio"
                  aria-checked={p.archetype === a.id}
                  tabIndex={p.archetype === a.id ? 0 : -1}
                  className={styles.archetype}
                  onClick={() => set("archetype", a.id)}
                  onKeyDown={(e) => onArchKey(e, i)}
                >
                  <span className={styles.archetypeTitle}>{a.label}</span>
                  <span className={styles.archetypeBody}>{a.description}</span>
                </button>
              ))}
            </div>
          </div>

          <div className={styles.sliders}>
            <Slider
              label="Risk aversion γ"
              value={p.gamma}
              min={0.01}
              max={1}
              step={0.01}
              format={(v) => v.toFixed(2)}
              hint="Higher γ shifts quotes harder to shed unwanted inventory."
              onChange={(v) => set("gamma", v)}
            />
            <Slider
              label="Base spread"
              value={p.baseSpreadBps}
              min={2}
              max={60}
              step={1}
              format={(v) => `${v} bps`}
              hint="Distance between your bid and ask in a calm market."
              onChange={(v) => set("baseSpreadBps", v)}
            />
            <Slider
              label="Inventory target"
              value={p.inventoryTargetEth}
              min={-40}
              max={40}
              step={1}
              format={(v) => `${fmtSigned(v, 0)} ETH`}
              hint={`The position the agent steers toward. It starts at ${startInventoryEth(p.archetype)} ETH.`}
              onChange={(v) => set("inventoryTargetEth", v)}
            />
            <Slider
              label="OOD trigger level λ"
              value={p.oodLambdaThreshold}
              min={0.2}
              max={3}
              step={0.05}
              format={(v) => v.toFixed(2)}
              hint={`Widen into defense mode once Hawkes λ(t) reaches this level. It is ${lambda.toFixed(3)} now.`}
              onChange={(v) => set("oodLambdaThreshold", v)}
            />
            <Slider
              label="OOD spread multiplier"
              value={p.oodSpreadMultiplier}
              min={1}
              max={6}
              step={0.1}
              format={(v) => `${v.toFixed(1)}×`}
              hint="How much the spread widens while the market is out of distribution."
              onChange={(v) => set("oodSpreadMultiplier", Math.round(v * 10) / 10)}
            />
            <Slider
              label="Arbitrage aggressiveness"
              value={p.arbAggressivenessPct}
              min={0}
              max={100}
              step={5}
              format={(v) => `${v}%`}
              hint={`Fires cross-venue arbitrage once |basis| reaches ${pv.arbTriggerBps} bps (break-even is ~34 bps).`}
              onChange={(v) => set("arbAggressivenessPct", v)}
            />
            <Slider
              label="Max drawdown limit"
              value={p.maxDrawdownLimitBps}
              min={100}
              max={5000}
              step={50}
              format={(v) => `${v.toLocaleString("en-US")} bps`}
              hint={`Self-halts after a ${(p.maxDrawdownLimitBps / 100).toFixed(1)}% peak-to-trough loss.`}
              onChange={(v) => set("maxDrawdownLimitBps", v)}
            />
            <Slider
              label="Order size"
              value={p.orderSizeEth}
              min={0.1}
              max={25}
              step={0.1}
              format={(v) => `${v.toFixed(1)} ETH`}
              hint={`About ${fmtUsd(p.orderSizeEth * frame.clobMidUsd, 0)} notional per quote at the current mid.`}
              onChange={(v) => set("orderSizeEth", Math.round(v * 10) / 10)}
            />
          </div>

          <div className="row wrap" style={{ ["--gap" as string]: "12px" }}>
            <button type="submit" className="btn btn-llm btn-lg" disabled={!!error} aria-disabled={!!error}>
              Deploy agent
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setP((s) => ({ ...DEFAULTS, name: s.name }))}
            >
              Reset parameters
            </button>
          </div>
        </form>

        <div className={styles.preview} aria-label="Strategy preview" role="group">
          <div className="row-between">
            <span className="h3" style={{ fontSize: 14 }}>
              Strategy preview
            </span>
            <Badge tone={pv.defensive ? "ask" : "bid"}>{pv.defensive ? "Defense mode" : "Normal quoting"}</Badge>
          </div>

          <div className={styles.quoteRow}>
            <div className={styles.quote}>
              <span className="label">Bid</span>
              <span className={styles.quoteValue} style={{ color: "var(--bid)" }}>
                {fmtUsd(pv.bid)}
              </span>
            </div>
            <div className={styles.quote}>
              <span className="label">Reservation r</span>
              <span className={styles.quoteValue}>{fmtUsd(pv.reservation)}</span>
            </div>
            <div className={styles.quote}>
              <span className="label">Ask</span>
              <span className={styles.quoteValue} style={{ color: "var(--ask)" }}>
                {fmtUsd(pv.ask)}
              </span>
            </div>
          </div>

          <div className={styles.ladder} role="img" aria-label={`Bid ${fmtUsd(pv.bid)}, mid ${fmtUsd(pv.mid)}, ask ${fmtUsd(pv.ask)}`}>
            <span className={styles.ladderMark} style={{ left: `${x(pv.bid)}%`, background: "var(--bid)" }} />
            <span className={styles.ladderMark} style={{ left: `${x(pv.ask)}%`, background: "var(--ask)" }} />
            <span className={styles.ladderMark} style={{ left: `${x(pv.mid)}%`, background: "var(--text-4)", width: 1 }} />
            <span className={styles.ladderMark} style={{ left: `${x(pv.reservation)}%`, background: "var(--llm)" }} />
            <span className={styles.ladderLabel} style={{ left: `${x(pv.mid)}%`, color: "var(--text-3)" }}>
              mid
            </span>
          </div>

          <div className={styles.formula} aria-label="Reservation price calculation">
            r = {pv.mid.toFixed(2)} − ({fmtSigned(pv.q, 0)})·{p.gamma.toFixed(2)}·{pv.sigmaUsd.toFixed(3)}² = {pv.reservation.toFixed(2)}
          </div>

          <ul className={styles.bullets}>
            <li>
              {arch.label}: {arch.description}
            </li>
            <li>
              Quotes {pv.spreadBps.toFixed(1)} bps wide
              {pv.defensive
                ? `, because λ(t) = ${lambda.toFixed(3)} is at or above your ${p.oodLambdaThreshold.toFixed(2)} trigger (${p.baseSpreadBps} bps × ${p.oodSpreadMultiplier.toFixed(1)}).`
                : `. It widens to ${(p.baseSpreadBps * p.oodSpreadMultiplier).toFixed(1)} bps once λ(t) reaches ${p.oodLambdaThreshold.toFixed(2)} (now ${lambda.toFixed(3)}).`}
            </li>
            <li>
              Starts {Math.abs(pv.q).toFixed(0)} ETH {pv.q > 0 ? "long" : pv.q < 0 ? "short" : "flat"} of target, so r sits{" "}
              {fmtSigned(pv.reservationOffsetBps, 1, " bps")} from mid
              {pv.skewCapped ? " (capped at one full spread)" : ""}. Regime vol is {REALIZED_VOL_BPS[frame.regime]} bps per epoch.
            </li>
            <li>
              Cross-venue basis is {fmtSigned(frame.basisBps, 0, " bps")}:{" "}
              {pv.arbLive ? "past your trigger, so it would arbitrage now." : `below your ${pv.arbTriggerBps} bps trigger, so it stays out.`}
            </li>
            <li>
              Stops quoting after a {(p.maxDrawdownLimitBps / 100).toFixed(1)}% peak-to-trough drawdown, a self-imposed brake ahead of the{" "}
              <ConceptPill concept="margin" label="maintenance margin" /> liquidation.
            </li>
          </ul>
          <p className="caption">
            Scored live with the <ConceptPill concept="acs" label="ACS" align="right" />, including{" "}
            <ConceptPill concept="ood" label="OOD survival" align="right" />.
          </p>
        </div>
      </div>
    </Panel>
  );
}
