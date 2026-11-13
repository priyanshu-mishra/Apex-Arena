"use client";

import "@/styles/legacy.css";
import { ArenaProvider } from "@/lib/arena";
import { AppShell } from "@/components/shell/AppShell";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <ArenaProvider>
      <AppShell>{children}</AppShell>
    </ArenaProvider>
  );
}
