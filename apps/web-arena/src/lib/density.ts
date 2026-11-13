"use client";

import { useCallback, useSyncExternalStore, type ReactNode } from "react";

/**
 * Simple / Pro density for the app. Simple (the default) shows the panels a
 * newcomer needs; Pro reveals the advanced ones. The choice is persisted in
 * `localStorage['apex-density']` and mirrored to `<html data-density>`.
 *
 * SSR-safe: the server snapshot is always Simple, and React swaps in the
 * stored value right after hydration (useSyncExternalStore), so a saved Pro
 * choice never causes a hydration mismatch.
 */
export type Density = "simple" | "pro";

export const DENSITY_KEY = "apex-density";
export const DEFAULT_DENSITY: Density = "simple";

export function parseDensity(raw: string | null | undefined): Density {
  return raw === "pro" ? "pro" : DEFAULT_DENSITY;
}

type Reader = Pick<Storage, "getItem">;

function browserStorage(): Reader | undefined {
  try {
    return typeof window === "undefined" ? undefined : window.localStorage;
  } catch {
    return undefined; // storage blocked (e.g. sandboxed iframe)
  }
}

/** Reads the saved density; Simple when nothing is saved or storage is unavailable. */
export function readDensity(storage: Reader | undefined = browserStorage()): Density {
  try {
    return parseDensity(storage?.getItem(DENSITY_KEY));
  } catch {
    return DEFAULT_DENSITY;
  }
}

/* ── one shared store for every useDensity() caller ── */

let current: Density | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function onStorage(e: StorageEvent) {
  if (e.key !== DENSITY_KEY) return;
  current = parseDensity(e.newValue);
  document.documentElement.dataset.density = current;
  emit();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) window.removeEventListener("storage", onStorage);
  };
}

function getSnapshot(): Density {
  if (current === null) {
    current = readDensity();
    document.documentElement.dataset.density = current;
  }
  return current;
}

function getServerSnapshot(): Density {
  return DEFAULT_DENSITY;
}

function setDensityValue(d: Density) {
  current = d;
  document.documentElement.dataset.density = d;
  try {
    localStorage.setItem(DENSITY_KEY, d);
  } catch {
    /* storage blocked: the choice lasts for this page view */
  }
  emit();
}

export function useDensity(): [Density, (d: Density) => void] {
  const density = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const set = useCallback((d: Density) => setDensityValue(d), []);
  return [density, set];
}

/** Renders its children only in Pro. */
export function Pro({ children }: { children?: ReactNode }): ReactNode {
  const [density] = useDensity();
  return density === "pro" ? children : null;
}

/** Renders its children only in Simple. */
export function Simple({ children }: { children?: ReactNode }): ReactNode {
  const [density] = useDensity();
  return density === "simple" ? children : null;
}
