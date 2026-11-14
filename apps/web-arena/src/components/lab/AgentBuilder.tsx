"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { fmtSigned, fmtUsd, useArena } from "../../lib/arena";
import type { CustomAgentConfig, LeaderboardEntryUi } from "../../lib/sharedBuffer";
import { cn } from "../../lib/utils";
import { Badge, ConceptPill, Panel } from "../ui";
import { btn, caption, field, fieldLabel, input, label, mono12, num, range, subhead } from "../ui/kit";
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
    <div className={field}>
      <label className={fieldLabel} htmlFor={id}>
        <span>{label}</span>
        <span className={cn(mono12, "text-bone")}>{format(value)}</span>
      </label>
      <input
        id={id}
        className={range}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-valuetext={format(value)}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <span className={cn(caption, "text-[12px]")}>{hint}</span>
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
      title="Agent builder"
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
      <div className="grid min-w-0 gap-6 2xl:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
        <form
          className="flex min-w-0 flex-col gap-5"
          onSubmit={(e) => {
            e.preventDefault();
            deploy();
          }}
          noValidate
        >
          <div className={field}>
            <label className={fieldLabel} htmlFor={nameId}>
              Agent name
            </label>
            <input
              id={nameId}
              className={input}
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
              <span id={errId} className="font-sans text-[12.5px] text-ask" role="alert">
                {error}
              </span>
            ) : null}
          </div>

          <div className={field}>
            <span className={fieldLabel} id={`${nameId}-arch`}>
              Archetype
            </span>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2" role="radiogroup" aria-labelledby={`${nameId}-arch`}>
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
                  className="flex flex-col gap-1.5 rounded-[2px] border border-rule-2 p-3 text-left transition-colors hover:border-bone-3 aria-checked:border-bone aria-checked:bg-haze"
                  onClick={() => set("archetype", a.id)}
                  onKeyDown={(e) => onArchKey(e, i)}
                >
                  <span className={subhead}>{a.label}</span>
                  <span className="font-sans text-[12.5px] leading-[1.45] text-bone-2">{a.description}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
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

          <div className="flex flex-wrap items-center gap-3">
            <button type="submit" className={btn("primary", "lg")} disabled={!!error} aria-disabled={!!error}>
              Deploy agent
            </button>
            <button
              type="button"
              className={btn()}
              onClick={() => setP((s) => ({ ...DEFAULTS, name: s.name }))}
            >
              Reset parameters
            </button>
          </div>
        </form>

        <div className="flex min-w-0 flex-col gap-4 border-t border-rule-2 pt-4 2xl:border-t-0 2xl:border-l 2xl:pt-0 2xl:pl-6" aria-label="Strategy preview" role="group">
          <div className="flex items-center justify-between gap-2">
            <span className={subhead}>Strategy preview</span>
            <Badge tone={pv.defensive ? "ask" : "bid"}>{pv.defensive ? "defense mode" : "normal quoting"}</Badge>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {[
              { k: "Bid", v: pv.bid, c: "var(--bid)" },
              { k: "Reservation r", v: pv.reservation, c: undefined },
              { k: "Ask", v: pv.ask, c: "var(--ask)" },
            ].map((q) => (
              <div key={q.k} className="flex min-w-0 flex-col gap-1.5">
                <span className={label}>{q.k}</span>
                <span className={cn(num, "text-[length:clamp(13px,1.2vw,17px)] text-bone")} style={q.c ? { color: q.c } : undefined}>
                  {fmtUsd(q.v)}
                </span>
              </div>
            ))}
          </div>

          <div className="relative h-[34px] border-b border-rule-2" role="img" aria-label={`Bid ${fmtUsd(pv.bid)}, mid ${fmtUsd(pv.mid)}, ask ${fmtUsd(pv.ask)}`}>
            <span className="absolute bottom-0 h-[18px] w-[2px]" style={{ left: `${x(pv.bid)}%`, background: "var(--bid)" }} />
            <span className="absolute bottom-0 h-[18px] w-[2px]" style={{ left: `${x(pv.ask)}%`, background: "var(--ask)" }} />
            <span className="absolute bottom-0 h-[26px] w-px bg-bone-3" style={{ left: `${x(pv.mid)}%` }} />
            <span className="absolute bottom-0 h-[12px] w-[2px] bg-bone" style={{ left: `${x(pv.reservation)}%` }} />
            <span className={cn(mono12, "absolute top-0 -translate-x-1/2 text-bone-3")} style={{ left: `${x(pv.mid)}%` }}>
              mid
            </span>
          </div>

          <div className={cn(mono12, "border-l border-bone pl-3 break-words text-bone")} aria-label="Reservation price calculation">
            r = {pv.mid.toFixed(2)} − ({fmtSigned(pv.q, 0)})·{p.gamma.toFixed(2)}·{pv.sigmaUsd.toFixed(3)}² = {pv.reservation.toFixed(2)}
          </div>

          <ul className="flex list-none flex-col gap-2 font-sans text-[13.5px] leading-[1.5] text-bone-2 [&>li]:border-b [&>li]:border-rule [&>li]:pb-2">
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
          <p className={caption}>
            Scored live with the <ConceptPill concept="acs" label="ACS" align="right" />, including{" "}
            <ConceptPill concept="ood" label="OOD survival" align="right" />.
          </p>
        </div>
      </div>
    </Panel>
  );
}
