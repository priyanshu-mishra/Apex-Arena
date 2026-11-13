"use client";

import Link from "next/link";
import { useEffect } from "react";
import { CanyonGlyph } from "@/components/landing/TopBar";
import { type Toast, type ToastTone, useArena } from "@/lib/arena";
import { buildNarrative } from "@/lib/narrative";
import { APP_ROUTES } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { AppNav, MobileNav } from "./AppNav";
import { AppStatusLine } from "./AppStatusLine";
import { ghostButton, horizonColor, keyHint } from "./chrome";
import { CommandMenu } from "./CommandMenu";
import { DensitySwitch } from "./DensitySwitch";

function isTypingTarget(t: EventTarget | null): boolean {
  if (!(t instanceof HTMLElement)) return false;
  const tag = t.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || t.isContentEditable;
}

/** Global keys: 1–4 sections, ⌘K / Ctrl+K command menu, Space pause, `.` step one tick. */
function useShellShortcuts() {
  const { setView, actions, paletteOpen, setPaletteOpen } = useArena();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen(!paletteOpen);
        return;
      }
      if (paletteOpen || e.metaKey || e.ctrlKey || e.altKey || isTypingTarget(e.target)) return;
      // Leave keys alone inside any open dialog or sheet.
      if (e.target instanceof Element && e.target.closest('[role="dialog"]')) return;
      const r = APP_ROUTES.find((x) => x.key === e.key);
      if (r) {
        e.preventDefault();
        setView(r.id);
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
}

/** Toast tone → a small data-colour mark (no purple: agent toasts use bone). */
const TONE_DOT: Record<ToastTone, string> = {
  bid: "bg-bid",
  ask: "bg-ask",
  evm: "bg-pool",
  chaos: "bg-shock",
  llm: "bg-bone-2",
};

function Toasts({ toasts, dismiss }: { toasts: Toast[]; dismiss: (id: number) => void }) {
  return (
    <div
      data-chrome
      aria-live="polite"
      className="pointer-events-none fixed right-4 bottom-[50px] z-[80] flex w-[min(380px,calc(100vw-32px))] flex-col gap-2 print:hidden"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          role="status"
          data-tone={t.tone}
          onClick={() => dismiss(t.id)}
          className="pointer-events-auto flex cursor-pointer flex-col gap-1 rounded-[2px] border border-rule bg-ink-2 px-3.5 py-3 duration-200 animate-in fade-in-0 slide-in-from-bottom-2 motion-reduce:animate-none"
        >
          <span className="flex items-center gap-2 font-sans text-[13px] leading-snug font-semibold text-bone [font-variation-settings:'wdth'_108]">
            <span aria-hidden className={cn("size-1.5 shrink-0 rounded-[50%]", TONE_DOT[t.tone])} />
            {t.title}
          </span>
          {t.body ? <span className="pl-3.5 font-sans text-[12px] leading-[1.45] text-bone-2">{t.body}</span> : null}
        </div>
      ))}
    </div>
  );
}

/**
 * The app shell in the landing's language: a top bar (wordmark, sections,
 * Simple / Pro, pause, ⌘K) whose ground carries the regime's horizon light,
 * a one-line market narrative, the page, the landing status line, toasts and
 * the command menu. Old class hooks `.app-shell` / `.view-container` stay for
 * the pages' print styles until Task 10.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const { frame, view, paused, actions, setPaletteOpen, toasts } = useArena();
  useShellShortcuts();

  const narrative = buildNarrative(frame);
  const horizon = { "--horizon": horizonColor(frame.regime) } as React.CSSProperties;

  return (
    <div className="app-shell flex min-h-svh flex-col bg-ink font-sans" data-regime={frame.regime}>
      <header
        data-chrome
        style={horizon}
        className="sticky top-0 z-40 border-b border-rule bg-[linear-gradient(180deg,var(--ink)_0%,var(--horizon)_100%)] text-bone transition-[--horizon] duration-1000 ease-out print:hidden"
      >
        <div className="mx-auto flex h-14 max-w-[1720px] items-center gap-4 px-[clamp(16px,3.9vw,56px)] lg:gap-6">
          <MobileNav className="md:hidden" />
          <Link
            href="/"
            aria-label="ApexArena, back to the overview"
            className="flex shrink-0 items-center gap-2.5 font-sans text-[15px] leading-none font-semibold tracking-[-0.01em] text-bone [font-variation-settings:'wdth'_118] [&_svg]:h-3.5 [&_svg]:w-[22px]"
          >
            <CanyonGlyph />
            ApexArena
          </Link>
          <AppNav className="hidden self-stretch md:flex" />
          <span className="flex-1" />
          <DensitySwitch />
          <button
            type="button"
            onClick={actions.togglePause}
            aria-label={paused ? "Resume simulation" : "Pause simulation"}
            title="Pause / resume (Space)"
            className={cn(ghostButton, "hidden w-[92px] md:inline-flex")}
          >
            {paused ? "Resume" : "Pause"}
          </button>
          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            aria-label="Open the command menu"
            aria-keyshortcuts="Meta+K Control+K"
            className={cn(ghostButton, "hidden md:inline-flex")}
          >
            <span className="max-lg:hidden">Commands</span>
            <span aria-hidden className={keyHint}>
              ⌘K
            </span>
          </button>
        </div>
      </header>

      <div
        data-chrome
        style={horizon}
        aria-live="polite"
        className="border-b border-rule bg-[linear-gradient(180deg,color-mix(in_srgb,var(--horizon)_55%,var(--ink))_0%,var(--ink)_100%)] transition-[--horizon] duration-1000 ease-out print:hidden"
      >
        <div className="mx-auto max-w-[1720px] px-[clamp(16px,3.9vw,56px)] py-2.5">
          <p className="font-sans text-[13px] leading-[1.5] text-pretty text-bone-2 max-md:line-clamp-2">
            <strong className="font-semibold text-bone">{narrative.headline}.</strong> {narrative.detail}
          </p>
        </div>
      </div>

      {process.env.NEXT_PUBLIC_STATIC_DEMO === "true" ? (
        <aside data-chrome aria-label="Demo limitations" className="border-b border-rule bg-ink-2 print:hidden">
          <p className="mx-auto max-w-[1720px] px-[clamp(16px,3.9vw,56px)] py-2.5 font-sans text-[13px] leading-[1.5] text-bone-2">
            <strong className="font-semibold text-bone">Browser demo.</strong> Trading, agents and benchmarks run in your
            browser. Native Rust/Python proof tools require the local app.
          </p>
        </aside>
      ) : null}

      <main className="view-container" key={view}>
        {children}
      </main>

      <AppStatusLine />
      <Toasts toasts={toasts} dismiss={actions.dismissToast} />
      <CommandMenu />
    </div>
  );
}
