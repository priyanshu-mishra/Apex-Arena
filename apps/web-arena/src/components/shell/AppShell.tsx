"use client";

import React, { useEffect } from "react";
import { useArena, VIEWS, fmtUsd, USER_AGENT_ID, type ViewId } from "../../lib/arena";
import { buildNarrative } from "../../lib/narrative";
import { Badge, Kbd } from "../ui";
import { CommandPalette } from "./CommandPalette";
import { OverviewView } from "../views/OverviewView";
import { ArenaView } from "../views/ArenaView";
import { AgentLabView } from "../views/AgentLabView";
import { BenchmarkView } from "../views/BenchmarkView";
import { ArchitectureView } from "../views/ArchitectureView";

const VIEW_COMPONENTS: Record<ViewId, React.ComponentType> = {
  overview: OverviewView,
  arena: ArenaView,
  lab: AgentLabView,
  bench: BenchmarkView,
  arch: ArchitectureView,
};

function isTypingTarget(t: EventTarget | null): boolean {
  if (!(t instanceof HTMLElement)) return false;
  const tag = t.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || t.isContentEditable;
}

export function AppShell() {
  const arena = useArena();
  const { frame, view, setView, paused, actions, setPaletteOpen, paletteOpen } = arena;

  // Global keyboard shortcuts: 1–5 views, ⌘K / Ctrl+K palette, Space pause, . step
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen(!paletteOpen);
        return;
      }
      if (paletteOpen || e.metaKey || e.ctrlKey || e.altKey || isTypingTarget(e.target)) return;
      const v = VIEWS.find((x) => x.key === e.key);
      if (v) {
        e.preventDefault();
        setView(v.id);
        return;
      }
      if (e.key === " " && !(e.target instanceof HTMLButtonElement)) {
        e.preventDefault();
        actions.togglePause();
      } else if (e.key === ".") {
        actions.step(1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [paletteOpen, setPaletteOpen, setView, actions]);

  const narrative = buildNarrative(frame);
  const you = frame.leaderboard.find((e) => e.agentId === USER_AGENT_ID);
  const yourRank = you ? frame.leaderboard.indexOf(you) + 1 : null;
  const ActiveView = VIEW_COMPONENTS[view];

  return (
    <div className="app-shell" data-regime={frame.regime}>
      <div className="weather-band" aria-hidden />
      <header className="topbar">
        <div className="topbar-inner">
          <button
            type="button"
            className="brand"
            onClick={() => setView("overview")}
            style={{ background: "none", border: 0, cursor: "pointer" }}
            aria-label="ApexArena home"
          >
            <span className="brand-mark" aria-hidden>
              A
            </span>
            ApexArena
          </button>

          <nav className="nav-tabs" role="tablist" aria-label="Workspaces">
            {VIEWS.map((v) => (
              <button
                key={v.id}
                type="button"
                role="tab"
                className="nav-tab"
                aria-selected={view === v.id}
                onClick={() => setView(v.id)}
                title={`${v.label} (${v.key})`}
              >
                {v.short}
                <Kbd>{v.key}</Kbd>
              </button>
            ))}
          </nav>

          <div className="topbar-tools">
            <span className="row num eth-price" style={{ ["--gap" as string]: "6px", fontSize: 13 }} title="Live CLOB mid price">
              <span className="text-3" style={{ fontFamily: "var(--font-sans)" }}>
                ETH
              </span>
              <span className="text-1" style={{ fontWeight: 600 }}>
                {frame.clobMidFormatted}
              </span>
            </span>
            <Badge tone="regime">{frame.regime.toLowerCase()}</Badge>
            <button
              type="button"
              className="btn btn-sm"
              onClick={actions.togglePause}
              aria-label={paused ? "Resume simulation" : "Pause simulation"}
              title="Pause / resume (Space)"
            >
              {paused ? "▶ Resume" : "❚❚ Pause"}
            </button>
            <button
              type="button"
              className="btn btn-sm btn-ghost"
              onClick={() => setPaletteOpen(true)}
              aria-label="Open command palette"
            >
              <span className="cmd-label">Commands</span> <Kbd>⌘K</Kbd>
            </button>
          </div>
        </div>
      </header>

      <div className="narrative-bar" aria-live="polite">
        <div className="narrative-inner">
          <span className="narrative-dot" aria-hidden />
          <p className="narrative-text grow">
            <strong>{narrative.headline}.</strong> {narrative.detail}
          </p>
          <span className="caption num narrative-tick" style={{ whiteSpace: "nowrap" }}>
            tick {frame.tick.toLocaleString()} · block #{frame.blockNumber.toLocaleString()}
          </span>
        </div>
      </div>

      {process.env.NEXT_PUBLIC_STATIC_DEMO === "true" ? (
        <aside className="narrative-bar" aria-label="Demo limitations">
          <div className="narrative-inner">
            <p className="narrative-text">
              <strong>Browser demo.</strong> Trading, agents and benchmarks run in your browser.
              Native Rust/Python proof tools require the local app.
            </p>
          </div>
        </aside>
      ) : null}

      <main className="view-container" key={view}>
        <ActiveView />
      </main>

      <footer className="statusbar">
        <div className="statusbar-inner">
          <span className="row" style={{ ["--gap" as string]: "6px" }}>
            <span className="dot" style={{ ["--accent" as string]: paused ? "var(--chaos)" : "var(--bid)" }} />
            {paused ? "Paused" : "Running"} · {arena.speed}× speed
          </span>
          <span>
            Pipeline: WebWorker + {frame.sharedBufferActive ? "SharedArrayBuffer" : "ring buffer"} @ 60 Hz
          </span>
          {you ? (
            <span>
              Your equity <span className="num text-1">{fmtUsd(you.equityUsd, 0)}</span>
              {yourRank ? <> · rank {yourRank} of {frame.leaderboard.length}</> : null}
            </span>
          ) : null}
          <span
            style={{ marginLeft: "auto" }}
            title={`${frame.stateHash}\nIn-browser kernel: 256-bit FNV-1a state digest. Native Rust kernel: SHA-256 (see Architecture).`}
          >
            State digest <span className="num text-2">{frame.stateHash.slice(0, 16)}…</span>
          </span>
        </div>
      </footer>

      <div className="toast-stack" aria-live="polite">
        {arena.toasts.map((t) => (
          <div key={t.id} className="toast" data-tone={t.tone} role="status" onClick={() => actions.dismissToast(t.id)}>
            <span className="toast-title">{t.title}</span>
            {t.body ? <span className="toast-body">{t.body}</span> : null}
          </div>
        ))}
      </div>

      {paletteOpen ? <CommandPalette /> : null}
    </div>
  );
}
