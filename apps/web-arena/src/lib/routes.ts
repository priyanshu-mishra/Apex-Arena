export type ViewId = "arena" | "agents" | "benchmark" | "proof";

export const APP_ROUTES: { id: ViewId; href: string; label: string; key: "1" | "2" | "3" | "4" }[] = [
  { id: "arena", href: "/app", label: "Arena", key: "1" },
  { id: "agents", href: "/app/agents", label: "Agents", key: "2" },
  { id: "benchmark", href: "/app/benchmark", label: "Benchmark", key: "3" },
  { id: "proof", href: "/app/proof", label: "Proof", key: "4" },
];

/** Maps a pathname (with or without a trailing slash) to the active app view. */
export function viewFromPathname(pathname: string | null): ViewId {
  const path = (pathname ?? "/app").replace(/\/+$/, "") || "/";
  const hit = APP_ROUTES.filter((r) => r.href !== "/app").find((r) => path === r.href || path.startsWith(`${r.href}/`));
  return hit?.id ?? "arena";
}
