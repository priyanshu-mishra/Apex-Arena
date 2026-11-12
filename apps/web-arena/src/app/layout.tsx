import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ApexArena v1.0 | Autonomous Multi-Agent Financial Arena & Dynamic Benchmark",
  description:
    "Deterministic L3 CLOB + Embedded Bluealloy Revm Multi-Agent Financial Trading Arena with Hawkes Process Chaos Regimes.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
