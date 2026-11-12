"use client";

import { ArenaProvider } from "../lib/arena";
import { AppShell } from "../components/shell/AppShell";

export default function Page() {
  return (
    <ArenaProvider>
      <AppShell />
    </ArenaProvider>
  );
}
