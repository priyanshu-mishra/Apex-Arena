import type { Metadata, Viewport } from "next";
import { archivo, martianMono } from "@/lib/fonts";
import { fontSupplementCss } from "@/lib/fontSupplements";
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

/**
 * Runs before first paint. `data-motion` lets the landing page hide its
 * reveal targets until GSAP takes over (never under reduced motion, and
 * cleared after 6 s if scripts never load). `data-depth` restores a saved
 * Precise choice so the page does not jump; React state still starts at
 * Plain and syncs in an effect.
 */
const PREPAINT = `(function(){var d=document.documentElement;try{if(!matchMedia("(prefers-reduced-motion: reduce)").matches&&!/[?&]rm(=|&|$)/.test(location.search)){d.setAttribute("data-motion","");setTimeout(function(){if(!window.__apexMotion)d.removeAttribute("data-motion")},6000)}if(localStorage.getItem("apex-depth")==="precise")d.dataset.depth="precise"}catch(e){}})();`;

/** Symbol supplements under the configured base path (GitHub Pages). */
const SUPPLEMENTS = fontSupplementCss(process.env.NEXT_PUBLIC_BASE_PATH ?? "");

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${archivo.variable} ${martianMono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: PREPAINT }} />
        <style dangerouslySetInnerHTML={{ __html: SUPPLEMENTS }} />
      </head>
      <body>
        <TooltipProvider>{children}</TooltipProvider>
      </body>
    </html>
  );
}
