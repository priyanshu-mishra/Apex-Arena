"use client";

import { useCallback, useEffect } from "react";
import { type Depth, useCanyon } from "@/lib/canyon/store";

const KEY = "apex-depth";

function persist(d: Depth) {
  try {
    localStorage.setItem(KEY, d);
  } catch {
    /* storage blocked: the choice lasts for this page view */
  }
}

/**
 * Plain / Precise. The store holds the value (scene labels read it);
 * it is persisted to `localStorage['apex-depth']` and mirrored to
 * `<html data-depth>`, which shows the `.precise` lines in CSS.
 * The server always renders Plain; the saved choice is applied in an effect
 * (no hydration mismatch). `?precise` opens in Precise.
 */
export function useDepth(): [Depth, (d: Depth) => void] {
  const depth = useCanyon((s) => s.depth);

  const setDepth = useCallback((d: Depth) => {
    useCanyon.getState().setDepth(d);
    document.documentElement.dataset.depth = d;
    persist(d);
    // Precise lines change the height of flowing chapters.
    window.dispatchEvent(new Event("apex:layout"));
  }, []);

  useEffect(() => {
    let saved: string | null = null;
    try {
      saved = localStorage.getItem(KEY);
    } catch {
      saved = null;
    }
    if (saved === "precise" || new URLSearchParams(window.location.search).has("precise")) setDepth("precise");
    // Mirror later changes made straight on the store (it fires on change only,
    // so it never overwrites the pre-paint value with the initial Plain).
    return useCanyon.subscribe((st, prev) => {
      if (st.depth !== prev.depth) document.documentElement.dataset.depth = st.depth;
    });
  }, [setDepth]);

  return [depth, setDepth];
}
