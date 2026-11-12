"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useArena, VIEWS, SCENARIOS } from "../../lib/arena";

interface Command {
  id: string;
  group: string;
  label: string;
  hint?: string;
  keywords?: string;
  run: () => void;
}

export function CommandPalette() {
  const { setPaletteOpen, setView, actions, paused, frame } = useArena();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const commands = useMemo<Command[]>(() => {
    const list: Command[] = [];
    VIEWS.forEach((v) =>
      list.push({ id: `view-${v.id}`, group: "Go to", label: v.label, hint: v.key, run: () => setView(v.id) })
    );
    SCENARIOS.forEach((s) =>
      list.push({
        id: `sc-${s.id}`,
        group: "Chaos scenarios",
        label: s.id === "flash-crash" ? "Trigger 350 bps flash crash" : s.label,
        keywords: s.description,
        run: () => actions.injectScenario(s.id),
      })
    );
    list.push({
      id: "arb",
      group: "Trading",
      label: "Execute atomic arbitrage (5 ETH)",
      hint: `basis ${frame.basisBps} bps`,
      keywords: "capture arb cross venue clob revm",
      run: () => actions.captureArb(5),
    });
    list.push({
      id: "pause",
      group: "Playback",
      label: paused ? "Resume simulation" : "Pause simulation",
      hint: "Space",
      run: actions.togglePause,
    });
    list.push({ id: "step", group: "Playback", label: "Step +1 tick", hint: ".", run: () => actions.step(1) });
    list.push({ id: "step10", group: "Playback", label: "Step +100 ticks (one macro epoch)", run: () => actions.step(100) });
    [1, 5, 15].forEach((s) =>
      list.push({ id: `spd-${s}`, group: "Playback", label: `Set speed to ${s}×`, run: () => actions.setSpeed(s) })
    );
    list.push({ id: "reset", group: "Playback", label: "Reset simulation to seed 42", run: actions.reset });
    list.push({
      id: "verify",
      group: "Verification",
      label: "Verify 5-run determinism (in-browser kernel)",
      keywords: "sha256 hash",
      run: () => {
        actions.verifyDeterminism();
        setView("arch");
      },
    });
    list.push({
      id: "bench",
      group: "Verification",
      label: "Run standardized benchmark suite",
      keywords: "tournament scorecard",
      run: () => {
        actions.runBenchmark();
        setView("bench");
      },
    });
    return list;
  }, [actions, paused, setView, frame.basisBps]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter((c) => `${c.label} ${c.group} ${c.keywords ?? ""}`.toLowerCase().includes(q));
  }, [commands, query]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);
  useEffect(() => {
    setActive(0);
  }, [query]);
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-index="${active}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const close = () => setPaletteOpen(false);
  const runAt = (i: number) => {
    const c = filtered[i];
    if (!c) return;
    close();
    c.run();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      close();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(filtered.length - 1, a + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      runAt(active);
    }
  };

  let lastGroup = "";
  return (
    <div className="cmdk-overlay" onMouseDown={close}>
      <div
        className="cmdk"
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={onKeyDown}
      >
        <input
          ref={inputRef}
          className="cmdk-input"
          placeholder="Type a command — e.g. flash crash, verify, arena…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search commands"
        />
        <div className="cmdk-list" ref={listRef} role="listbox">
          {filtered.length === 0 ? <div className="empty">No command matches “{query}”.</div> : null}
          {filtered.map((c, i) => {
            const header = c.group !== lastGroup ? c.group : null;
            lastGroup = c.group;
            return (
              <React.Fragment key={c.id}>
                {header ? <div className="cmdk-group">{header}</div> : null}
                <button
                  type="button"
                  role="option"
                  aria-selected={i === active}
                  data-index={i}
                  data-active={i === active}
                  className="cmdk-item"
                  onMouseEnter={() => setActive(i)}
                  onClick={() => runAt(i)}
                >
                  {c.label}
                  {c.hint ? <span className="cmdk-hint num">{c.hint}</span> : null}
                </button>
              </React.Fragment>
            );
          })}
        </div>
        <div className="cmdk-footer">
          <span>↑↓ navigate</span>
          <span>↵ run</span>
          <span>esc close</span>
        </div>
      </div>
    </div>
  );
}
