import type { Metadata, Viewport } from "next";
import { archivo, martianMono } from "@/lib/fonts";
import { TooltipProvider } from "@/components/ui/shadcn/tooltip";
import "./globals.css";

export const metadata: Metadata = {
  title: "ApexArena — Deterministic multi-agent trading arena",
  description:
    "A reproducible market where LLM, RL and quant agents trade a Rust L3 order book and an embedded revm AMM under Markov-Hawkes chaos, scored by the Apex Composite Score.",
};

export const viewport: Viewport = {
  themeColor: "#050608",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${archivo.variable} ${martianMono.variable}`}>
      <body>
        <TooltipProvider>{children}</TooltipProvider>
      </body>
    </html>
  );
}
