"use client";

import { useMemo } from "react";
import { useArena } from "../../lib/arena";
import { tokenizeJson, type JsonTokenKind } from "./model";
import styles from "./Lab.module.css";

const CLASS: Record<JsonTokenKind, string> = {
  key: styles.tKey,
  string: styles.tString,
  number: styles.tNumber,
  literal: styles.tLiteral,
  punct: styles.tPunct,
};

/** Syntax-highlighted, read-only JSON in a `.code-block`. */
export function JsonView({ value, compact, label }: { value: unknown; compact?: boolean; label: string }) {
  const text = useMemo(() => JSON.stringify(value, null, 2), [value]);
  const tokens = useMemo(() => tokenizeJson(text), [text]);
  return (
    <pre
      className={`code-block ${styles.json} ${compact ? styles.jsonCompact : ""}`}
      aria-label={label}
      tabIndex={0}
    >
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
      actions.toast({ title: `${what} copied`, body: `${text.length.toLocaleString()} characters on your clipboard.`, tone: "evm" });
    } catch {
      actions.toast({ title: "Copy failed", body: "The browser blocked clipboard access.", tone: "ask" });
    }
  };
  return (
    <button type="button" className="btn btn-sm btn-ghost" onClick={onCopy} aria-label={`Copy ${what} to clipboard`}>
      Copy
    </button>
  );
}
