"use client";

import { useMemo } from "react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@/components/ui/shadcn/command";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/shadcn/dialog";
import { SCENARIOS, useArena } from "@/lib/arena";
import { useDensity } from "@/lib/density";
import { APP_ROUTES } from "@/lib/routes";
import { keyHint } from "./chrome";

interface Entry {
  id: string;
  group: string;
  label: string;
  hint?: string;
  keywords?: string[];
  run: () => void;
}

/**
 * ⌘K / Ctrl+K: shadcn Command in a Dialog. Same commands as the old palette
 * (sections, chaos scenarios, arbitrage, playback, verification) plus the
 * density switch. Opened state lives in `useArena().paletteOpen`.
 */
export function CommandMenu() {
  const { paletteOpen, setPaletteOpen, setView, actions, paused, frame } = useArena();
  const [density, setDensity] = useDensity();

  const entries = useMemo<Entry[]>(() => {
    const list: Entry[] = [];
    for (const r of APP_ROUTES) {
      list.push({ id: `view-${r.id}`, group: "Go to", label: r.label, hint: r.key, keywords: ["go to", "open", "page"], run: () => setView(r.id) });
    }
    for (const s of SCENARIOS) {
      list.push({
        id: `sc-${s.id}`,
        group: "Chaos",
        label: s.id === "flash-crash" ? "Trigger a 350 bps flash crash" : s.label,
        keywords: [s.description, "scenario", "chaos", "regime"],
        run: () => actions.injectScenario(s.id),
      });
    }
    list.push({
      id: "arb",
      group: "Trading",
      label: "Execute atomic arbitrage (5 ETH)",
      hint: `gap ${frame.basisBps} bps`,
      keywords: ["capture", "arb", "cross venue", "clob", "revm", "pool"],
      run: () => actions.captureArb(5),
    });
    list.push({ id: "pause", group: "Playback", label: paused ? "Resume simulation" : "Pause simulation", hint: "Space", run: actions.togglePause });
    list.push({ id: "step", group: "Playback", label: "Step one tick", hint: ".", run: () => actions.step(1) });
    list.push({ id: "step100", group: "Playback", label: "Step 100 ticks (one macro epoch)", run: () => actions.step(100) });
    for (const s of [1, 5, 15]) {
      list.push({ id: `spd-${s}`, group: "Playback", label: `Set speed to ${s}×`, keywords: ["speed", "faster", "slower"], run: () => actions.setSpeed(s) });
    }
    list.push({ id: "reset", group: "Playback", label: "Reset simulation to seed 42", keywords: ["restart"], run: actions.reset });
    list.push({
      id: "density",
      group: "View",
      label: density === "pro" ? "Switch to Simple" : "Switch to Pro",
      keywords: ["density", "simple", "pro", "advanced", "panels"],
      run: () => setDensity(density === "pro" ? "simple" : "pro"),
    });
    list.push({
      id: "verify",
      group: "Verification",
      label: "Verify 5-run determinism (in-browser kernel)",
      keywords: ["fnv-1a", "digest", "hash", "replay", "proof"],
      run: () => {
        actions.verifyDeterminism();
        setView("proof");
      },
    });
    list.push({
      id: "bench",
      group: "Verification",
      label: "Run the standardized benchmark suite",
      keywords: ["tournament", "scorecard", "acs"],
      run: () => {
        actions.runBenchmark();
        setView("benchmark");
      },
    });
    return list;
  }, [actions, paused, setView, frame.basisBps, density, setDensity]);

  const groups = useMemo(() => {
    const out: { name: string; items: Entry[] }[] = [];
    for (const e of entries) {
      const g = out.find((x) => x.name === e.group);
      if (g) g.items.push(e);
      else out.push({ name: e.group, items: [e] });
    }
    return out;
  }, [entries]);

  return (
    <Dialog open={paletteOpen} onOpenChange={setPaletteOpen}>
      <DialogContent
        data-chrome
        showCloseButton={false}
        aria-describedby={undefined}
        className="top-[14vh] max-w-[calc(100%-32px)] translate-y-0 gap-0 overflow-hidden rounded-[2px] border border-rule-2 bg-ink-2 p-0 text-bone shadow-none sm:max-w-[640px]"
      >
        <DialogTitle className="sr-only">Command menu</DialogTitle>
        <Command
          loop
          className="rounded-none bg-transparent font-sans text-bone **:data-[slot=command-input-wrapper]:h-12 **:data-[slot=command-input-wrapper]:px-4"
        >
          <CommandInput
            placeholder="Type a command or a section: flash crash, verify, agents…"
            className="h-12 text-[16px] text-bone placeholder:text-bone-3 focus-visible:outline-none!"
          />
          <CommandList className="max-h-[min(420px,60svh)] p-2">
            <CommandEmpty className="py-7 text-center text-[13px] text-bone-3">No command matches.</CommandEmpty>
            {groups.map((g) => (
              <CommandGroup
                key={g.name}
                heading={g.name}
                className="p-0 pb-1 text-bone **:[[cmdk-group-heading]]:px-3 **:[[cmdk-group-heading]]:pt-2.5 **:[[cmdk-group-heading]]:pb-1.5 **:[[cmdk-group-heading]]:text-[12px] **:[[cmdk-group-heading]]:font-medium **:[[cmdk-group-heading]]:text-bone-3"
              >
                {g.items.map((e) => (
                  <CommandItem
                    key={e.id}
                    value={e.label}
                    keywords={e.keywords}
                    onSelect={() => {
                      setPaletteOpen(false);
                      e.run();
                    }}
                    className="rounded-[2px] px-3 py-2.5 text-[14px] text-bone-2 data-[selected=true]:bg-haze data-[selected=true]:text-bone"
                  >
                    {e.label}
                    {e.hint ? <CommandShortcut className={`${keyHint} tracking-normal`}>{e.hint}</CommandShortcut> : null}
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
          <div
            aria-hidden
            className="flex gap-4 border-t border-rule px-4 py-2.5 font-mono text-[12px] text-bone-3 [font-variation-settings:'wdth'_87.5]"
          >
            <span>↑↓ move</span>
            <span>↵ run</span>
            <span>esc close</span>
          </div>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
