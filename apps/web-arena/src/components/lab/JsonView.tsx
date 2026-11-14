"use client";

import { useMemo } from "react";
import { useArena } from "../../lib/arena";
import { cn } from "../../lib/utils";
import { btn, codeBlock } from "../ui/kit";
import { tokenizeJson, type JsonTokenKind } from "./model";

/* Quiet syntax colours: bone keys, bone-2 strings, mint numbers, amber literals. */
const CLASS: Record<JsonTokenKind, string> = {
  key: "text-bone",
  string: "text-bone-2",
  number: "text-bid",
  literal: "text-shock",
  punct: "text-bone-3",
};

/** Syntax-highlighted, read-only JSON. */
export function JsonView({ value, compact, label }: { value: unknown; compact?: boolean; label: string }) {
  const text = useMemo(() => JSON.stringify(value, null, 2), [value]);
  const tokens = useMemo(() => tokenizeJson(text), [text]);
  return (
    <pre className={cn(codeBlock, compact ? "max-h-[220px]" : "max-h-[520px]")} aria-label={label} tabIndex={0}>
      <code>
        {tokens.map((t, i) => (
          <span key={i} className={CLASS[t.kind]}>
            {t.text}
          </span>
        ))}
      </code>
    </pre>
  );
}

export function CopyButton({ value, what }: { value: unknown; what: string }) {
  const { actions } = useArena();
  const onCopy = async () => {
    const text = typeof value === "string" ? value : JSON.stringify(value, null, 2);
    try {
      await navigator.clipboard.writeText(text);
      actions.toast({ title: `${what} copied`, body: `${text.length.toLocaleString("en-US")} characters on your clipboard.`, tone: "evm" });
    } catch {
      actions.toast({ title: "Copy failed", body: "The browser blocked clipboard access.", tone: "ask" });
    }
  };
  return (
    <button type="button" className={btn("ghost", "sm")} onClick={onCopy} aria-label={`Copy ${what} to clipboard`}>
      Copy
    </button>
  );
}
