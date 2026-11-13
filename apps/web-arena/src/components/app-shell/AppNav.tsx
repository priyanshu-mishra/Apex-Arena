"use client";

import Link from "next/link";
import { useState } from "react";
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/shadcn/sheet";
import { useArena } from "@/lib/arena";
import { APP_ROUTES } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { ghostButton, keyHint } from "./chrome";

/**
 * The four app sections as text links. The current one is bone with a 1px
 * bone rule underneath (the landing's "Back to the overview" link style);
 * the others are bone-2. The key hint is decorative (`aria-keyshortcuts`
 * carries it), so each link's name is just the section.
 */
export function AppNav({ className }: { className?: string }) {
  const { view } = useArena();
  return (
    <nav aria-label="App sections" className={cn("flex h-full items-stretch gap-1", className)}>
      {APP_ROUTES.map((r) => {
        const current = view === r.id;
        return (
          <Link
            key={r.id}
            href={r.href}
            aria-current={current ? "page" : undefined}
            aria-keyshortcuts={r.key}
            className={cn(
              "flex items-center gap-2 border-b px-2.5 pt-px font-sans text-[13.5px] leading-none font-semibold [font-variation-settings:'wdth'_108] transition-colors duration-200",
              current ? "border-bone text-bone" : "border-transparent text-bone-2 hover:text-bone"
            )}
          >
            {r.label}
            <span aria-hidden className={keyHint}>
              {r.key}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}

/** Phones: the sections, playback and commands in a left sheet. */
export function MobileNav({ className }: { className?: string }) {
  const { view, paused, actions, setPaletteOpen } = useArena();
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger className={cn(ghostButton, "px-3", className)}>Menu</SheetTrigger>
      <SheetContent
        side="left"
        data-chrome
        className="w-[min(320px,86vw)] gap-0 border-r border-rule-2 bg-ink-2 p-0 text-bone shadow-none sm:max-w-sm"
      >
        <div className="border-b border-rule px-5 pt-5 pb-4">
          <SheetTitle className="font-sans text-[13px] font-semibold text-bone [font-variation-settings:'wdth'_108]">
            Menu
          </SheetTitle>
          <SheetDescription className="mt-1 text-[12px] text-bone-3">Sections, playback and commands.</SheetDescription>
        </div>
        <nav aria-label="App sections" className="flex flex-col">
          {APP_ROUTES.map((r) => {
            const current = view === r.id;
            return (
              <Link
                key={r.id}
                href={r.href}
                onClick={() => setOpen(false)}
                aria-current={current ? "page" : undefined}
                className={cn(
                  "flex items-center justify-between border-b border-rule px-5 py-4 font-sans text-[19px] leading-none font-semibold [font-variation-settings:'wdth'_110]",
                  current ? "text-bone" : "text-bone-2"
                )}
              >
                {r.label}
                {current ? <span className="font-mono text-[12px] font-normal text-bone-3">current</span> : null}
              </Link>
            );
          })}
        </nav>
        <div className="flex flex-col gap-2.5 px-5 py-5">
          <button
            type="button"
            className={cn(ghostButton, "w-full")}
            onClick={() => {
              actions.togglePause();
              setOpen(false);
            }}
          >
            {paused ? "Resume simulation" : "Pause simulation"}
          </button>
          <button
            type="button"
            className={cn(ghostButton, "w-full")}
            onClick={() => {
              setOpen(false);
              setPaletteOpen(true);
            }}
          >
            Commands
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
